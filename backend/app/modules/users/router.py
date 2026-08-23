"""
Users Router — User Management (SUPER_ADMIN only)
──────────────────────────────────────────────────
Only SUPER_ADMIN can create, update, or delete users.
Viewing the list is restricted to USER_MANAGE permission.
"""

import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import hash_password, validate_password_strength
from app.middleware.auth import require_permission, get_current_user
from app.models.user import User, Role, UserRole, RolePermission, Permission
from app.schemas.user import UserCreate, UserUpdate, UserResponse, UserListResponse
from app.services.audit_service import log_action

router = APIRouter(prefix="/users", tags=["User Management"])


@router.get("", response_model=UserListResponse, summary="List all users", include_in_schema=False)
@router.get("/", response_model=UserListResponse, summary="List all users")
async def list_users(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("USER_MANAGE")),
) -> UserListResponse:
    query = select(User).options(
        selectinload(User.user_roles)
        .selectinload(UserRole.role)
        .selectinload(Role.role_permissions)
        .selectinload(RolePermission.permission)
    )

    if search:
        from sqlalchemy import or_
        query = query.where(
            or_(
                User.username.ilike(f"%{search}%"),
                User.full_name.ilike(f"%{search}%"),
                User.email.ilike(f"%{search}%"),
            )
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    offset = (page - 1) * size
    query = query.order_by(User.created_at.desc()).offset(offset).limit(size)
    users = (await db.execute(query)).scalars().all()

    return UserListResponse(
        items=[_build_user_response(u) for u in users],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
)
async def create_user(
    request: Request,
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("USER_MANAGE")),
) -> UserResponse:
    # Validate password strength
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Check username uniqueness
    existing = (await db.execute(
        select(User).where(User.username == user_data.username.lower())
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    # Check email uniqueness
    existing_email = (await db.execute(
        select(User).where(User.email == user_data.email.lower())
    )).scalar_one_or_none()
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        username=user_data.username.lower(),
        email=user_data.email.lower(),
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        badge_number=user_data.badge_number,
        department=user_data.department,
    )
    db.add(user)
    await db.flush()

    # Assign roles
    for role_name in user_data.role_names:
        role = (await db.execute(
            select(Role).where(Role.name == role_name)
        )).scalar_one_or_none()
        if role:
            db.add(UserRole(
                user_id=user.id,
                role_id=role.id,
                assigned_by=current_user.id,
            ))

    await db.commit()
    await db.refresh(user)

    await log_action(
        db, "USER_CREATED",
        user_id=current_user.id, username=current_user.username,
        resource_type="USER", resource_id=user.id,
        details={"username": user.username, "roles": user_data.role_names},
        request=request,
    )

    # Reload with roles
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role)
            .selectinload(Role.role_permissions).selectinload(RolePermission.permission)
        )
        .where(User.id == user.id)
    )
    user = result.scalar_one()
    return _build_user_response(user)


@router.get("/{user_id}", response_model=UserResponse, summary="Get user details")
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("USER_MANAGE")),
) -> UserResponse:
    user = await _load_user(user_id, db)
    return _build_user_response(user)


@router.put("/{user_id}", response_model=UserResponse, summary="Update user")
async def update_user(
    request: Request,
    user_id: str,
    update_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("USER_MANAGE")),
) -> UserResponse:
    user = await _load_user(user_id, db)

    updated = {}
    if update_data.email is not None:
        user.email = update_data.email.lower()
        updated["email"] = user.email
    if update_data.full_name is not None:
        user.full_name = update_data.full_name
        updated["full_name"] = user.full_name
    if update_data.badge_number is not None:
        user.badge_number = update_data.badge_number
    if update_data.department is not None:
        user.department = update_data.department
    if update_data.is_active is not None:
        user.is_active = update_data.is_active
        updated["is_active"] = user.is_active

    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    await log_action(
        db, "USER_UPDATED",
        user_id=current_user.id, username=current_user.username,
        resource_type="USER", resource_id=user_id,
        details=updated, request=request,
    )

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role)
            .selectinload(Role.role_permissions).selectinload(RolePermission.permission)
        )
        .where(User.id == user_id)
    )
    user = result.scalar_one()
    return _build_user_response(user)


@router.post("/{user_id}/roles", summary="Assign roles to user")
async def assign_roles(
    request: Request,
    user_id: str,
    role_names: list[str],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("USER_MANAGE")),
) -> dict:
    user = await _load_user(user_id, db)

    # Remove existing roles
    existing_roles = (await db.execute(
        select(UserRole).where(UserRole.user_id == user_id)
    )).scalars().all()
    for ur in existing_roles:
        await db.delete(ur)

    # Assign new roles
    for role_name in role_names:
        role = (await db.execute(
            select(Role).where(Role.name == role_name)
        )).scalar_one_or_none()
        if role:
            db.add(UserRole(
                user_id=user_id,
                role_id=role.id,
                assigned_by=current_user.id,
            ))

    await db.commit()

    await log_action(
        db, "USER_ROLES_CHANGED",
        user_id=current_user.id, username=current_user.username,
        resource_type="USER", resource_id=user_id,
        details={"new_roles": role_names}, request=request,
    )

    return {"message": f"Roles updated for {user.username}", "roles": role_names}


@router.post("/{user_id}/unlock", summary="Unlock a locked user account")
async def unlock_user(
    request: Request,
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("USER_MANAGE")),
) -> dict:
    user = await _load_user(user_id, db)
    user.is_locked = False
    user.failed_attempts = 0
    user.locked_until = None
    await db.commit()

    await log_action(
        db, "USER_UNLOCKED",
        user_id=current_user.id, username=current_user.username,
        resource_type="USER", resource_id=user_id,
        request=request,
    )

    return {"message": f"Account unlocked for {user.username}"}


async def _load_user(user_id: str, db: AsyncSession) -> User:
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role)
            .selectinload(Role.role_permissions).selectinload(RolePermission.permission)
        )
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _build_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        badge_number=user.badge_number,
        department=user.department,
        is_active=user.is_active,
        is_locked=user.is_locked,
        roles=user.roles,
        permissions=user.permissions,
        last_login=user.last_login,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )

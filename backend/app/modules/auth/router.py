"""
Authentication Router
──────────────────────
Handles login, logout, and current-user endpoints.

Rate limiting is applied to login to prevent brute-force attacks.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token, password_needs_rehash, hash_password
)
from app.core.config import settings
from app.middleware.auth import get_current_user
from app.models.user import User, UserRole, Role, RolePermission, Permission
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserResponse
from app.services.audit_service import log_action, log_security_event

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive JWT token",
    responses={
        401: {"description": "Invalid credentials or account locked"},
        429: {"description": "Too many requests"},
    },
)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Authenticate a user and return a JWT access token.
    
    Security controls:
    - Rate limited (see middleware)
    - Failed attempts tracked
    - Account lockout after MAX_FAILED_ATTEMPTS
    - Generic error messages (don't reveal if username exists)
    - Constant-time password comparison (Argon2id)
    """
    client_ip = _get_client_ip(request)

    # Generic error message — never reveal if username exists or not
    # This prevents username enumeration attacks
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
    )

    # Load user with all role/permission data
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.user_roles)
            .selectinload(UserRole.role)
            .selectinload(Role.role_permissions)
            .selectinload(RolePermission.permission)
        )
        .where(User.username == login_data.username.lower())
    )
    user: Optional[User] = result.scalar_one_or_none()

    # If user doesn't exist, still verify a dummy password
    # This prevents timing attacks from revealing valid usernames
    if user is None:
        verify_password("dummy_password_to_prevent_timing_attack", 
                       "$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy")
        await log_security_event(
            db, "FAILED_LOGIN",
            f"Login attempt for non-existent username: {login_data.username[:50]}",
            severity="LOW",
            request=request,
        )
        await log_action(db, "LOGIN_FAILED", result="FAILURE",
                        username=login_data.username[:50], request=request)
        raise auth_error

    # Check account status
    if not user.is_active:
        await log_action(db, "LOGIN_FAILED", result="FAILURE",
                        user_id=user.id, username=user.username, request=request)
        raise auth_error

    # Check if account is locked
    if user.is_locked:
        locked_until = user.locked_until.replace(tzinfo=None) if (user.locked_until and user.locked_until.tzinfo) else user.locked_until
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if locked_until and locked_until > now:
            await log_security_event(
                db, "LOGIN_ATTEMPT_LOCKED_ACCOUNT",
                f"Login attempt on locked account: {user.username}",
                severity="HIGH",
                user_id=user.id, username=user.username,
                request=request,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is temporarily locked. Please try again later.",
            )
        else:
            # Lockout expired — auto-unlock
            user.is_locked = False
            user.failed_attempts = 0

    # Verify password
    if not verify_password(login_data.password, user.password_hash):
        # Increment failed attempts
        user.failed_attempts += 1

        if user.failed_attempts >= settings.MAX_FAILED_ATTEMPTS:
            # Lock the account
            user.is_locked = True
            user.locked_until = datetime.now(timezone.utc) + timedelta(
                minutes=settings.LOCKOUT_DURATION_MINUTES
            )
            await db.commit()

            await log_security_event(
                db, "ACCOUNT_LOCKED",
                f"Account locked after {user.failed_attempts} failed attempts: {user.username}",
                severity="HIGH",
                user_id=user.id, username=user.username,
                request=request,
                details={"failed_attempts": user.failed_attempts},
            )
            await log_action(
                db, "ACCOUNT_LOCKED", result="SECURITY",
                user_id=user.id, username=user.username,
                request=request,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account locked due to multiple failed login attempts",
            )

        await db.commit()

        await log_security_event(
            db, "FAILED_LOGIN",
            f"Failed login attempt for {user.username} (attempt {user.failed_attempts})",
            severity="MEDIUM",
            user_id=user.id, username=user.username,
            request=request,
        )
        await log_action(db, "LOGIN_FAILED", result="FAILURE",
                        user_id=user.id, username=user.username, request=request)
        raise auth_error

    # --- Login successful ---
    user.failed_attempts = 0
    user.last_login = datetime.now(timezone.utc)
    user.last_login_ip = client_ip

    # Rehash password if algorithm parameters have been updated
    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(login_data.password)

    await db.commit()

    # Build JWT token
    roles = user.roles
    permissions = user.permissions

    access_token = create_access_token(
        subject=user.id,
        roles=roles,
        permissions=permissions,
    )

    await log_action(
        db, "LOGIN_SUCCESS", result="SUCCESS",
        user_id=user.id, username=user.username,
        request=request,
        details={"roles": roles},
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        roles=roles,
        permissions=permissions,
    )


@router.post(
    "/logout",
    summary="Logout (client should discard token)",
    status_code=status.HTTP_200_OK,
)
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Log out the current user.
    
    Note: JWTs are stateless — we can't truly invalidate them server-side
    without a token blacklist (Redis). For this MVP, we:
    1. Log the logout event
    2. Instruct the client to discard the token
    
    The short token expiry (60 min) limits the window of exposure.
    """
    await log_action(
        db, "LOGOUT", result="SUCCESS",
        user_id=current_user.id,
        username=current_user.username,
        request=request,
    )
    return {"message": "Logged out successfully. Please discard your token."}


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user",
)
async def get_me(
    current_user=Depends(get_current_user),
):
    """Return the current authenticated user's profile."""
    return current_user


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

"""
Authentication & Authorization Middleware
──────────────────────────────────────────
JWT validation and RBAC via FastAPI dependency injection.

Performance: permissions are read from the JWT payload (embedded at login)
so we only need a lightweight user existence check, not a full role JOIN,
on every request.
"""

from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


class AuthenticatedUser:
    """
    Lightweight user object constructed from JWT claims.
    Avoids a full DB JOIN on every request while still verifying
    the user is active/unlocked with a single-column DB check.
    """
    def __init__(self, user: User, roles: list[str], permissions: list[str]):
        self.id = user.id
        self.username = user.username
        self.email = user.email
        self.full_name = user.full_name
        self.badge_number = user.badge_number
        self.department = user.department
        self.is_active = user.is_active
        self.is_locked = user.is_locked
        self.last_login = user.last_login
        self.created_at = user.created_at
        self.updated_at = user.updated_at
        self.failed_attempts = user.failed_attempts
        self.locked_until = user.locked_until
        self.password_hash = user.password_hash
        self._roles = roles
        self._permissions = permissions

    @property
    def roles(self) -> list[str]:
        return self._roles

    @property
    def permissions(self) -> list[str]:
        return self._permissions

    def has_permission(self, permission: str) -> bool:
        return permission in self._permissions


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> AuthenticatedUser:
    """
    Validate JWT and return the current user.
    Permissions come from the JWT payload — no DB JOIN needed.
    Only checks user.is_active and user.is_locked via a lean query.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_exception

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise credentials_exception

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise credentials_exception

    # Lean DB check — only fetch what we need to verify active/locked status
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is deactivated",
        )

    if user.is_locked:
        from datetime import datetime, timezone
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is temporarily locked",
            )
        user.is_locked = False
        user.failed_attempts = 0
        await db.commit()

    # Extract roles and permissions from JWT (embedded at login time)
    roles: list[str] = payload.get("roles", [])
    permissions: list[str] = payload.get("permissions", [])

    return AuthenticatedUser(user, roles, permissions)


def require_permission(permission_name: str):
    """Dependency factory: require a specific permission."""
    async def checker(
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if not current_user.has_permission(permission_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {permission_name}",
            )
        return current_user
    return checker


def require_any_permission(*permission_names: str):
    """Dependency factory: require any one of the given permissions."""
    async def checker(
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if not any(p in current_user.permissions for p in permission_names):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user
    return checker


def require_role(role_name: str):
    """Dependency factory: require a specific role."""
    async def checker(
        current_user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if role_name not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role",
            )
        return current_user
    return checker


# Alias so routers can import CurrentUser from here
CurrentUser = AuthenticatedUser

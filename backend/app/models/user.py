"""
User, Role, and Permission Models
────────────────────────────────────
These models implement the RBAC (Role-Based Access Control) system.

RBAC explained simply:
- A User has one or more Roles
- A Role has one or more Permissions
- We check Permissions (not Roles) at the API level

This is more flexible than role-checking because we can add
new permissions without changing code — just update the DB.
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Index, Integer,
    String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import INET, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Permission(Base):
    __tablename__ = "permissions"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # Relationships
    role_permissions: Mapped[List["RolePermission"]] = relationship(
        back_populates="permission", cascade="all, delete-orphan"
    )


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # Relationships
    role_permissions: Mapped[List["RolePermission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )
    user_roles: Mapped[List["UserRole"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )

    @property
    def permissions(self) -> List[str]:
        """Get permission names for this role."""
        return [rp.permission.name for rp in self.role_permissions if rp.permission]


class RolePermission(Base):
    """Junction table: Role ↔ Permission (many-to-many)"""
    __tablename__ = "role_permissions"

    role_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True
    )
    permission_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True
    )

    # Relationships
    role: Mapped["Role"] = relationship(back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship(back_populates="role_permissions")


class UserRole(Base):
    """Junction table: User ↔ Role (many-to-many) with metadata"""
    __tablename__ = "user_roles"

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True
    )
    role_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True
    )
    assigned_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=True
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship(
        back_populates="user_roles", foreign_keys=[user_id]
    )
    role: Mapped["Role"] = relationship(back_populates="user_roles")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    badge_number: Mapped[Optional[str]] = mapped_column(String(50), unique=True)
    department: Mapped[Optional[str]] = mapped_column(String(255))

    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Login tracking
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_login_ip: Mapped[Optional[str]] = mapped_column(String(45))  # IPv6 max length

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    user_roles: Mapped[List["UserRole"]] = relationship(
        back_populates="user",
        foreign_keys=[UserRole.user_id],
        cascade="all, delete-orphan",
        lazy="selectin",  # Auto-load roles with user
    )

    @property
    def roles(self) -> List[str]:
        """Get role names for this user."""
        return [ur.role.name for ur in self.user_roles if ur.role]

    @property
    def permissions(self) -> List[str]:
        """
        Get all unique permissions across all roles.
        This is what gets embedded in the JWT token.
        """
        perms = set()
        for ur in self.user_roles:
            if ur.role:
                for rp in ur.role.role_permissions:
                    if rp.permission:
                        perms.add(rp.permission.name)
        return list(perms)

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions

    # Indexes
    __table_args__ = (
        Index("idx_users_username", "username"),
        Index("idx_users_email", "email"),
    )

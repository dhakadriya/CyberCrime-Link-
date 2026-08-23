"""Audit Log Model — Immutable action trail"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuditLog(Base):
    """
    Immutable audit trail for all sensitive actions.
    
    Records are NEVER updated or deleted (append-only).
    The application should not provide any DELETE endpoint for audit logs.
    
    NEVER log: passwords, JWT tokens, secrets, file contents
    DO log: user IDs, actions, resource IDs, outcomes, IPs
    """
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL")
    )
    # Denormalized: preserve username even if user is deleted
    username: Mapped[Optional[str]] = mapped_column(String(50))

    # Action type: LOGIN_SUCCESS, CASE_CREATED, EVIDENCE_UPLOADED, etc.
    action: Mapped[str] = mapped_column(String(100), nullable=False)

    # What type of resource was accessed/modified
    resource_type: Mapped[Optional[str]] = mapped_column(String(100))
    resource_id: Mapped[Optional[str]] = mapped_column(String(255))

    # SUCCESS | FAILURE | DENIED
    result: Mapped[str] = mapped_column(String(20), default="SUCCESS", nullable=False)

    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)

    # Safe additional context (no secrets!)
    details: Mapped[Optional[dict]] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    __table_args__ = (
        Index("idx_audit_user", "user_id"),
        Index("idx_audit_action", "action"),
        Index("idx_audit_created", "created_at"),
        Index("idx_audit_resource", "resource_type", "resource_id"),
    )

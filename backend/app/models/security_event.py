"""Security Event Model"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SecurityEvent(Base):
    """
    Security-specific events (subset of audit with severity classification).
    
    Examples:
    - FAILED_LOGIN (MEDIUM)
    - ACCOUNT_LOCKED (HIGH)
    - UNAUTHORIZED_ACCESS_ATTEMPT (HIGH)
    - BRUTE_FORCE_DETECTED (CRITICAL)
    - SUSPICIOUS_DOWNLOAD (MEDIUM)
    - EVIDENCE_INTEGRITY_FAILED (CRITICAL)
    - INVALID_JWT_ATTEMPT (MEDIUM)
    """
    __tablename__ = "security_events"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)

    # LOW | MEDIUM | HIGH | CRITICAL
    severity: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)

    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL")
    )
    username: Mapped[Optional[str]] = mapped_column(String(50))

    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[Optional[dict]] = mapped_column(JSONB)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    __table_args__ = (
        Index("idx_security_type", "event_type"),
        Index("idx_security_severity", "severity"),
        Index("idx_security_created", "created_at"),
    )

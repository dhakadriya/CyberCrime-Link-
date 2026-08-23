"""Evidence and EvidenceCustody Models"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import (
    BigInteger, DateTime, ForeignKey, Index, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Evidence(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    case_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("cases.id", ondelete="RESTRICT"), nullable=False
    )
    evidence_number: Mapped[str] = mapped_column(String(100), nullable=False)

    # IMAGE | VIDEO | DOCUMENT | AUDIO | PHYSICAL | DIGITAL
    evidence_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    # File information
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(200), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # SHA-256 hash of file contents — this is the integrity fingerprint
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    # ACTIVE | TRANSFERRED | ARCHIVED | COMPROMISED
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False)

    current_custodian: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id")
    )
    uploaded_by: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    case: Mapped["Case"] = relationship(back_populates="evidence_items")  # type: ignore[name-defined]
    uploader: Mapped["User"] = relationship(foreign_keys=[uploaded_by])  # type: ignore[name-defined]
    custodian: Mapped[Optional["User"]] = relationship(foreign_keys=[current_custodian])  # type: ignore[name-defined]
    custody_chain: Mapped[List["EvidenceCustody"]] = relationship(
        back_populates="evidence",
        cascade="all, delete-orphan",
        order_by="EvidenceCustody.transferred_at",
    )

    __table_args__ = (
        Index("idx_evidence_case", "case_id"),
        Index("idx_evidence_number", "evidence_number"),
        Index("idx_evidence_hash", "sha256_hash"),
    )


class EvidenceCustody(Base):
    """
    Immutable custody transfer records.
    Every time evidence changes hands, a new record is created.
    Records are NEVER modified — they form an audit trail.
    """
    __tablename__ = "evidence_custody"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    evidence_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("evidence.id", ondelete="RESTRICT"), nullable=False
    )
    previous_custodian: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id")
    )
    new_custodian: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id")
    )
    transferred_by: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False
    )

    # CREATED | TRANSFERRED | REVIEWED | ARCHIVED | INTEGRITY_CHECK
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text)

    # Snapshot of SHA-256 at time of transfer — proves file wasn't modified
    sha256_at_transfer: Mapped[Optional[str]] = mapped_column(String(64))

    transferred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    # Relationships
    evidence: Mapped["Evidence"] = relationship(back_populates="custody_chain")
    prev_user: Mapped[Optional["User"]] = relationship(foreign_keys=[previous_custodian])  # type: ignore[name-defined]
    new_user: Mapped[Optional["User"]] = relationship(foreign_keys=[new_custodian])  # type: ignore[name-defined]
    transfer_user: Mapped["User"] = relationship(foreign_keys=[transferred_by])  # type: ignore[name-defined]

    __table_args__ = (
        Index("idx_custody_evidence", "evidence_id"),
    )

"""Investigation Event Model (Timeline)"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InvestigationEvent(Base):
    """
    Timeline events for a case.
    Every significant action creates a timeline entry.
    
    Examples: CASE_CREATED, EVIDENCE_UPLOADED, WITNESS_INTERVIEWED,
              SUSPECT_ADDED, STATUS_CHANGED, EVIDENCE_TRANSFERRED
    """
    __tablename__ = "investigation_events"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    case_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    created_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id")
    )
    related_person: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("persons.id")
    )
    related_evidence: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("evidence.id")
    )
    metadata_json: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)

    # Relationships
    case: Mapped["Case"] = relationship(back_populates="investigation_events")  # type: ignore[name-defined]
    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by])  # type: ignore[name-defined]
    person: Mapped[Optional["Person"]] = relationship(foreign_keys=[related_person])  # type: ignore[name-defined]
    evidence: Mapped[Optional["Evidence"]] = relationship(foreign_keys=[related_evidence])  # type: ignore[name-defined]

    __table_args__ = (
        Index("idx_events_case", "case_id"),
        Index("idx_events_occurred", "occurred_at"),
    )

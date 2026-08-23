"""Relationship Model — Graph edges between entities"""

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Relationship(Base):
    """
    A directed edge in the investigation graph.
    
    Can connect: PERSON ↔ PERSON, PERSON ↔ CASE,
                 PERSON ↔ EVIDENCE, PERSON ↔ LOCATION,
                 PERSON ↔ VEHICLE
    
    Used by the React Flow graph and the prioritization engine.
    """
    __tablename__ = "relationships"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )

    # Source entity
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    source_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)

    # Target entity
    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)

    # Relationship type
    # FRIEND_OF | ASSOCIATED_WITH | OWNER_OF | WITNESS_TO | RELATED_TO | LINKED_TO
    relationship_type: Mapped[str] = mapped_column(String(100), nullable=False)

    # WEAK | MEDIUM | STRONG
    strength: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    created_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    case_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("cases.id")
    )

    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by])  # type: ignore[name-defined]

    __table_args__ = (
        Index("idx_relationships_source", "source_type", "source_id"),
        Index("idx_relationships_target", "target_type", "target_id"),
    )

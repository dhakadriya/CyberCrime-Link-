"""Suspect Score Model — Prioritization Engine Results"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SuspectScore(Base):
    """
    Stores the result of the prioritization engine for a person in a case.
    
    IMPORTANT: This is an analytical score, NOT a determination of guilt.
    Every score is accompanied by an explanation of contributing factors.
    
    score_breakdown: {
        "previous_cases": 25.0,
        "case_type_similarity": 20.0,
        "relationship_strength": 15.0,
        "evidence_association": 10.0,
        "geographic_relevance": 5.0
    }
    
    contributing_factors: [
        "2 previous cases of similar type (Robbery)",
        "Strong relationship with known associate",
        "Linked to 1 evidence item in this case"
    ]
    
    data_sources: {
        "previous_cases_count": 2,
        "relationship_count": 3,
        "evidence_links": 1
    }
    """
    __tablename__ = "suspect_scores"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    case_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    person_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("persons.id", ondelete="CASCADE"), nullable=False
    )
    score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    score_breakdown: Mapped[dict] = mapped_column(JSONB, nullable=False)
    contributing_factors: Mapped[list] = mapped_column(JSONB, nullable=False)
    data_sources: Mapped[dict] = mapped_column(JSONB, nullable=False)
    engine_version: Mapped[str] = mapped_column(
        String(20), default="1.0.0-rules", nullable=False
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    generated_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id")
    )
    is_latest: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    case: Mapped["Case"] = relationship(back_populates="suspect_scores")  # type: ignore[name-defined]
    person: Mapped["Person"] = relationship(back_populates="suspect_scores")  # type: ignore[name-defined]

    __table_args__ = (
        Index("idx_scores_case", "case_id"),
        Index("idx_scores_person", "person_id"),
    )

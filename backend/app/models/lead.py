"""Investigative Lead Model"""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class InvestigativeLead(Base):
    """
    An auto-generated or manually created investigative lead.
    Every lead must be explainable and traceable to source data.
    
    IMPORTANT: Leads are analytical aids — not guilt determinations.
    """
    __tablename__ = "investigative_leads"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    lead_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # NETWORK_BRIDGE | HIGH_DEGREE_NODE | COMMUNITY_BRIDGE | ANOMALY | MANUAL
    description: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)
    # LOW | MEDIUM | HIGH | CRITICAL

    # Subject entity
    subject_type: Mapped[Optional[str]] = mapped_column(String(50))
    subject_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False))
    subject_name: Mapped[Optional[str]] = mapped_column(String(500))

    # Linked case
    case_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("cases.id")
    )

    # Supporting facts (JSON stored as Text for SQLite compat)
    supporting_data: Mapped[Optional[str]] = mapped_column(Text)
    # JSON: {"relationships": N, "communities": N, "evidence": [...], "explanation": "..."}

    # Status: OPEN | REVIEWED | ASSIGNED | DISMISSED | ACTIONED
    status: Mapped[str] = mapped_column(String(30), default="OPEN", nullable=False)

    assigned_to: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id")
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Source provenance
    source_module: Mapped[Optional[str]] = mapped_column(String(100))
    # e.g. "network_analysis", "anomaly_detection", "manual"

    auto_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    __table_args__ = (
        Index("idx_leads_status", "status"),
        Index("idx_leads_lead_type", "lead_type"),
        Index("idx_leads_subject_id", "subject_id"),
        Index("idx_leads_case_id", "case_id"),
    )

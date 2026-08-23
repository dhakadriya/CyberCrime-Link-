"""Case and CaseAssignment Models"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    case_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    case_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    location: Mapped[Optional[str]] = mapped_column(String(500))
    incident_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Status: DRAFT | OPEN | UNDER_INVESTIGATION | ON_HOLD | SOLVED | CLOSED | ARCHIVED
    status: Mapped[str] = mapped_column(String(50), default="OPEN", nullable=False)
    # Priority: LOW | MEDIUM | HIGH | CRITICAL
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)

    created_by: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])  # type: ignore[name-defined]
    assignments: Mapped[List["CaseAssignment"]] = relationship(
        back_populates="case", cascade="all, delete-orphan", lazy="selectin"
    )
    case_persons: Mapped[List["CasePerson"]] = relationship(  # type: ignore[name-defined]
        back_populates="case", cascade="all, delete-orphan"
    )
    evidence_items: Mapped[List["Evidence"]] = relationship(  # type: ignore[name-defined]
        back_populates="case"
    )
    investigation_events: Mapped[List["InvestigationEvent"]] = relationship(  # type: ignore[name-defined]
        back_populates="case", cascade="all, delete-orphan"
    )
    suspect_scores: Mapped[List["SuspectScore"]] = relationship(  # type: ignore[name-defined]
        back_populates="case", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_cases_case_number", "case_number"),
        Index("idx_cases_status", "status"),
        Index("idx_cases_priority", "priority"),
        Index("idx_cases_created_by", "created_by"),
    )


class CaseAssignment(Base):
    __tablename__ = "case_assignments"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    case_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # LEAD_INVESTIGATOR | ASSIGNED_OFFICER | SUPERVISOR
    role: Mapped[str] = mapped_column(String(100), default="ASSIGNED_OFFICER", nullable=False)
    assigned_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id")
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    removed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    case: Mapped["Case"] = relationship(back_populates="assignments")
    user: Mapped["User"] = relationship(foreign_keys=[user_id])  # type: ignore[name-defined]

    __table_args__ = (
        UniqueConstraint("case_id", "user_id", name="uq_case_user_assignment"),
    )

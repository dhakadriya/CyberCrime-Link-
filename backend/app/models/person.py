"""Person and CasePerson Models"""

from datetime import date, datetime, timezone
from typing import List, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean, Date, DateTime, ForeignKey, Index, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Person(Base):
    __tablename__ = "persons"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    first_name: Mapped[str] = mapped_column(String(255), nullable=False)
    last_name: Mapped[str] = mapped_column(String(255), nullable=False)
    alias: Mapped[Optional[str]] = mapped_column(String(255))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    nationality: Mapped[Optional[str]] = mapped_column(String(100))
    national_id: Mapped[Optional[str]] = mapped_column(String(100))  # Synthetic only
    address: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    occupation: Mapped[Optional[str]] = mapped_column(String(255))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    photo_path: Mapped[Optional[str]] = mapped_column(String(500))

    created_by: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    case_persons: Mapped[List["CasePerson"]] = relationship(
        back_populates="person", cascade="all, delete-orphan"
    )
    suspect_scores: Mapped[List["SuspectScore"]] = relationship(  # type: ignore[name-defined]
        back_populates="person"
    )

    __table_args__ = (
        Index("idx_persons_name", "last_name", "first_name"),
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class CasePerson(Base):
    """
    Associates a Person with a Case in a specific role.
    A person can appear in multiple cases with different roles.
    """
    __tablename__ = "case_persons"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4())
    )
    case_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    person_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("persons.id", ondelete="CASCADE"), nullable=False
    )
    # SUSPECT | VICTIM | WITNESS | COMPLAINANT | OFFICER | OTHER
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    added_by: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id")
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    removed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    case: Mapped["Case"] = relationship(back_populates="case_persons")  # type: ignore[name-defined]
    person: Mapped["Person"] = relationship(back_populates="case_persons")

    __table_args__ = (
        UniqueConstraint("case_id", "person_id", "role", name="uq_case_person_role"),
        Index("idx_case_persons_case", "case_id"),
        Index("idx_case_persons_person", "person_id"),
    )

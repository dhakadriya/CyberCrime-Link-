"""
Import all models. Applies SQLite compatibility patches before model import.
"""
import os

_db_url = os.environ.get("DATABASE_URL", "sqlite")

if "sqlite" in _db_url:
    from sqlalchemy import JSON, String
    from sqlalchemy.dialects import postgresql

    # JSONB -> JSON (generic)
    postgresql.JSONB = JSON  # type: ignore[attr-defined]

    # UUID(as_uuid=...) -> String(36)
    class _UUIDCompat(String):
        cache_ok = True
        def __init__(self, as_uuid=False, **kw):
            kw.pop("length", None)
            super().__init__(length=36)

    postgresql.UUID = _UUIDCompat  # type: ignore[attr-defined]

    # INET -> String(45)
    class _INETCompat(String):
        cache_ok = True
        def __init__(self, **kw):
            kw.pop("length", None)
            super().__init__(length=45)

    postgresql.INET = _INETCompat  # type: ignore[attr-defined]

# Import all models after patch is applied
from app.models.user import User, Role, Permission, RolePermission, UserRole
from app.models.case import Case, CaseAssignment
from app.models.person import Person, CasePerson
from app.models.evidence import Evidence, EvidenceCustody
from app.models.investigation import InvestigationEvent
from app.models.relationship import Relationship
from app.models.location import Location
from app.models.vehicle import Vehicle
from app.models.scoring import SuspectScore
from app.models.audit import AuditLog
from app.models.security_event import SecurityEvent
from app.models.lead import InvestigativeLead

__all__ = [
    "User", "Role", "Permission", "RolePermission", "UserRole",
    "Case", "CaseAssignment",
    "Person", "CasePerson",
    "Evidence", "EvidenceCustody",
    "InvestigationEvent",
    "Relationship",
    "Location", "Vehicle",
    "SuspectScore",
    "AuditLog",
    "SecurityEvent",
    "InvestigativeLead",
]

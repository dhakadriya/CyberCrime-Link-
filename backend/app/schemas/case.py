"""Case Schemas"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

VALID_STATUSES = {"DRAFT", "OPEN", "UNDER_INVESTIGATION", "ON_HOLD", "SOLVED", "CLOSED", "ARCHIVED"}
VALID_PRIORITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
VALID_TYPES = {"ROBBERY", "BURGLARY", "FRAUD", "ASSAULT", "MURDER", "KIDNAPPING",
               "CYBERCRIME", "DRUG_TRAFFICKING", "MONEY_LAUNDERING", "OTHER"}


class CaseCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=500)
    case_type: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=5000)
    location: Optional[str] = Field(None, max_length=500)
    incident_date: Optional[datetime] = None
    priority: str = Field(default="MEDIUM")
    status: str = Field(default="OPEN")  # Allow DRAFT on creation

    model_config = {"str_strip_whitespace": True}

    def model_post_init(self, __context):
        if self.priority not in VALID_PRIORITIES:
            raise ValueError(f"Priority must be one of: {VALID_PRIORITIES}")
        if self.status not in VALID_STATUSES:
            raise ValueError(f"Status must be one of: {VALID_STATUSES}")


class CaseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=500)
    case_type: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=5000)
    location: Optional[str] = Field(None, max_length=500)
    incident_date: Optional[datetime] = None
    priority: Optional[str] = None
    status: Optional[str] = None

    model_config = {"str_strip_whitespace": True}


class CaseStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = Field(None, max_length=500)

    def model_post_init(self, __context):
        if self.status not in VALID_STATUSES:
            raise ValueError(f"Status must be one of: {VALID_STATUSES}")


class CaseAssignRequest(BaseModel):
    user_id: str
    role: str = Field(default="ASSIGNED_OFFICER")


class AssignedOfficerResponse(BaseModel):
    user_id: str
    username: str
    full_name: str
    role: str
    assigned_at: datetime

    model_config = {"from_attributes": True}


class CaseCompletionResponse(BaseModel):
    """Calculated from actual DB data — never hardcoded."""
    percentage: int
    has_persons: bool
    persons_count: int
    has_evidence: bool
    evidence_count: int
    has_relationships: bool
    relationships_count: int
    has_events: bool
    events_count: int
    has_description: bool
    has_location: bool
    has_incident_date: bool


class CaseResponse(BaseModel):
    id: str
    case_number: str
    title: str
    case_type: str
    description: Optional[str] = None
    location: Optional[str] = None
    incident_date: Optional[datetime] = None
    status: str
    priority: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    # Summary counts
    persons_count: int = 0
    evidence_count: int = 0
    assigned_officers: List[AssignedOfficerResponse] = []

    model_config = {"from_attributes": True}


class CaseListResponse(BaseModel):
    items: List[CaseResponse]
    total: int
    page: int
    size: int
    pages: int


# ── Wizard / Bulk Import schemas ────────────────────────────────────────────

class WizardPersonEntry(BaseModel):
    """Person data entered during case wizard."""
    first_name: str = Field(..., min_length=1, max_length=255)
    last_name: str = Field(..., min_length=1, max_length=255)
    alias: Optional[str] = Field(None, max_length=255)
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    nationality: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=1000)
    phone: Optional[str] = Field(None, max_length=50)
    occupation: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=2000)
    role: str = "SUSPECT"
    existing_person_id: Optional[str] = None  # If linking existing person

    model_config = {"str_strip_whitespace": True}


class WizardRelationshipEntry(BaseModel):
    source_type: str = "PERSON"
    source_id: str
    target_type: str = "PERSON"
    target_id: str
    relationship_type: str = "ASSOCIATED_WITH"
    strength: str = "MEDIUM"
    notes: Optional[str] = Field(None, max_length=500)


class WizardEventEntry(BaseModel):
    event_type: str = Field(..., max_length=100)
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=2000)
    occurred_at: Optional[datetime] = None


class CaseWizardCreate(BaseModel):
    """Full case wizard submission — all steps in one payload."""
    # Step 1: Case info
    title: str = Field(..., min_length=3, max_length=500)
    case_type: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=5000)
    location: Optional[str] = Field(None, max_length=500)
    incident_date: Optional[datetime] = None
    priority: str = Field(default="MEDIUM")
    status: str = Field(default="OPEN")

    # Step 2: Persons (optional at creation)
    persons: List[WizardPersonEntry] = Field(default_factory=list)

    # Step 4: Relationships (optional)
    relationships: List[WizardRelationshipEntry] = Field(default_factory=list)

    # Step 5: Events (optional)
    events: List[WizardEventEntry] = Field(default_factory=list)

    model_config = {"str_strip_whitespace": True}

    def model_post_init(self, __context):
        if self.priority not in VALID_PRIORITIES:
            raise ValueError(f"Priority must be one of: {VALID_PRIORITIES}")


# ── Import schemas ───────────────────────────────────────────────────────────

class ImportRowError(BaseModel):
    row: int
    field: Optional[str] = None
    message: str


class ImportSheetPreview(BaseModel):
    sheet: str
    valid_rows: int
    invalid_rows: int
    duplicate_rows: int
    errors: List[ImportRowError]


class ImportPreviewResponse(BaseModel):
    filename: str
    file_size: int
    sheets_found: List[str]
    cases: ImportSheetPreview
    persons: ImportSheetPreview
    relationships: Optional[ImportSheetPreview] = None
    events: Optional[ImportSheetPreview] = None
    can_import: bool
    total_valid: int
    total_invalid: int


class ImportConfirmResponse(BaseModel):
    cases_created: int
    persons_created: int
    persons_linked: int
    relationships_created: int
    events_created: int
    errors: List[str]
    audit_id: Optional[str] = None



class CaseCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=500)
    case_type: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=5000)
    location: Optional[str] = Field(None, max_length=500)
    incident_date: Optional[datetime] = None
    priority: str = Field(default="MEDIUM")

    model_config = {"str_strip_whitespace": True}

    def model_post_init(self, __context):
        if self.priority not in VALID_PRIORITIES:
            raise ValueError(f"Priority must be one of: {VALID_PRIORITIES}")


class CaseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=500)
    case_type: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=5000)
    location: Optional[str] = Field(None, max_length=500)
    incident_date: Optional[datetime] = None
    priority: Optional[str] = None

    model_config = {"str_strip_whitespace": True}


class CaseStatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = Field(None, max_length=500)

    def model_post_init(self, __context):
        if self.status not in VALID_STATUSES:
            raise ValueError(f"Status must be one of: {VALID_STATUSES}")


class CaseAssignRequest(BaseModel):
    user_id: str
    role: str = Field(default="ASSIGNED_OFFICER")


class AssignedOfficerResponse(BaseModel):
    user_id: str
    username: str
    full_name: str
    role: str
    assigned_at: datetime

    model_config = {"from_attributes": True}


class CaseResponse(BaseModel):
    id: str
    case_number: str
    title: str
    case_type: str
    description: Optional[str] = None
    location: Optional[str] = None
    incident_date: Optional[datetime] = None
    status: str
    priority: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    # Summary counts
    persons_count: int = 0
    evidence_count: int = 0
    assigned_officers: List[AssignedOfficerResponse] = []

    model_config = {"from_attributes": True}


class CaseListResponse(BaseModel):
    items: List[CaseResponse]
    total: int
    page: int
    size: int
    pages: int

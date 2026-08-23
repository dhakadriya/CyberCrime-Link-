"""Investigation Event Schemas"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class InvestigationEventCreate(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = Field(None, max_length=2000)
    occurred_at: Optional[datetime] = None
    related_person: Optional[str] = None
    related_evidence: Optional[str] = None

    model_config = {"str_strip_whitespace": True}


class InvestigationEventResponse(BaseModel):
    id: str
    case_id: str
    event_type: str
    title: str
    description: Optional[str] = None
    occurred_at: datetime
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    related_person_id: Optional[str] = None
    related_person_name: Optional[str] = None
    related_evidence_id: Optional[str] = None
    related_evidence_number: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}


class TimelineResponse(BaseModel):
    events: List[InvestigationEventResponse]
    total: int

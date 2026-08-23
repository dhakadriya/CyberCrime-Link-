"""Evidence Schemas"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class EvidenceTransferRequest(BaseModel):
    new_custodian_id: str
    remarks: Optional[str] = Field(None, max_length=1000)


class CustodyResponse(BaseModel):
    id: str
    evidence_id: str
    previous_custodian_name: Optional[str] = None
    new_custodian_name: Optional[str] = None
    transferred_by_name: str
    action: str
    remarks: Optional[str] = None
    sha256_at_transfer: Optional[str] = None
    transferred_at: datetime

    model_config = {"from_attributes": True}


class EvidenceIntegrityResult(BaseModel):
    evidence_id: str
    evidence_number: str
    is_intact: bool
    stored_hash: str
    current_hash: str
    message: str
    checked_at: datetime


class EvidenceResponse(BaseModel):
    id: str
    case_id: str
    evidence_number: str
    evidence_type: str
    description: Optional[str] = None
    original_filename: str
    stored_filename: str
    mime_type: str
    file_size: int
    sha256_hash: str
    status: str
    current_custodian_id: Optional[str] = None
    current_custodian_name: Optional[str] = None
    uploaded_by_id: str
    uploaded_by_name: str
    uploaded_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EvidenceListResponse(BaseModel):
    items: List[EvidenceResponse]
    total: int
    page: int
    size: int
    pages: int

"""Person Schemas"""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, Field

VALID_ROLES = {"SUSPECT", "VICTIM", "WITNESS", "COMPLAINANT", "OFFICER", "OTHER"}


class PersonCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=255)
    last_name: str = Field(..., min_length=1, max_length=255)
    alias: Optional[str] = Field(None, max_length=255)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, max_length=20)
    nationality: Optional[str] = Field(None, max_length=100)
    national_id: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=1000)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    occupation: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=5000)

    model_config = {"str_strip_whitespace": True}


class PersonUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=255)
    last_name: Optional[str] = Field(None, min_length=1, max_length=255)
    alias: Optional[str] = Field(None, max_length=255)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, max_length=20)
    nationality: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=1000)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[str] = Field(None, max_length=255)
    occupation: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = Field(None, max_length=5000)

    model_config = {"str_strip_whitespace": True}


class CasePersonCreate(BaseModel):
    person_id: str
    role: str
    notes: Optional[str] = Field(None, max_length=1000)

    def model_post_init(self, __context):
        if self.role not in VALID_ROLES:
            raise ValueError(f"Role must be one of: {VALID_ROLES}")


class CasePersonResponse(BaseModel):
    id: str
    case_id: str
    person_id: str
    person_name: str
    role: str
    notes: Optional[str] = None
    added_at: datetime

    model_config = {"from_attributes": True}


class PersonCaseHistory(BaseModel):
    case_id: str
    case_number: str
    title: str
    case_type: str
    status: str
    role: str
    added_at: datetime

    model_config = {"from_attributes": True}


class PersonResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    full_name: str
    alias: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    nationality: Optional[str] = None
    national_id: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    occupation: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    case_history: List[PersonCaseHistory] = []

    model_config = {"from_attributes": True}


class PersonListResponse(BaseModel):
    items: List[PersonResponse]
    total: int
    page: int
    size: int
    pages: int

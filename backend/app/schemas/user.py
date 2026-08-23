"""User Schemas"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class PermissionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class RoleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(..., min_length=12, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)
    badge_number: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=255)
    role_names: List[str] = Field(default_factory=list)

    model_config = {"str_strip_whitespace": True}


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    badge_number: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None

    model_config = {"str_strip_whitespace": True}


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    badge_number: Optional[str] = None
    department: Optional[str] = None
    is_active: bool
    is_locked: bool
    roles: List[str] = []
    permissions: List[str] = []
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int
    page: int
    size: int
    pages: int

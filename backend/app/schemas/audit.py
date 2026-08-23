"""Audit and Security Event Schemas"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    username: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    result: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    size: int
    pages: int


class SecurityEventResponse(BaseModel):
    id: str
    event_type: str
    severity: str
    user_id: Optional[str] = None
    username: Optional[str] = None
    ip_address: Optional[str] = None
    description: str
    details: Optional[Dict[str, Any]] = None
    resolved: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SecurityEventListResponse(BaseModel):
    items: List[SecurityEventResponse]
    total: int
    page: int
    size: int
    pages: int

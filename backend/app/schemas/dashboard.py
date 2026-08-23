"""Dashboard Schemas"""

from typing import Any, Dict, List
from pydantic import BaseModel


class CaseStats(BaseModel):
    total: int
    open: int
    under_investigation: int
    on_hold: int
    solved: int
    closed: int
    archived: int
    high_priority: int
    critical_priority: int


class PersonStats(BaseModel):
    total: int
    suspects: int
    victims: int
    witnesses: int


class EvidenceStats(BaseModel):
    total: int
    images: int
    videos: int
    documents: int
    audio: int
    active: int
    archived: int


class DashboardStats(BaseModel):
    cases: CaseStats
    persons: PersonStats
    evidence: EvidenceStats
    recent_security_events: int
    total_users: int


class ChartDataPoint(BaseModel):
    name: str
    value: int
    color: str = "#6366f1"


class ChartData(BaseModel):
    cases_by_status: List[ChartDataPoint]
    cases_by_type: List[ChartDataPoint]
    cases_by_priority: List[ChartDataPoint]
    evidence_by_type: List[ChartDataPoint]
    activity_last_7_days: List[Dict[str, Any]]

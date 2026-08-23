"""Suspect Prioritization Score Schemas"""

from datetime import datetime
from typing import Any, Dict, List
from pydantic import BaseModel


class ScoreBreakdown(BaseModel):
    previous_cases: float = 0.0
    case_type_similarity: float = 0.0
    relationship_strength: float = 0.0
    evidence_association: float = 0.0
    geographic_relevance: float = 0.0


class SuspectScoreResponse(BaseModel):
    id: str
    case_id: str
    person_id: str
    person_name: str
    score: float
    score_breakdown: ScoreBreakdown
    contributing_factors: List[str]
    data_sources: Dict[str, Any]
    engine_version: str
    generated_at: datetime
    is_latest: bool

    model_config = {"from_attributes": True}


class PrioritizationResult(BaseModel):
    case_id: str
    case_number: str
    candidates: List[SuspectScoreResponse]
    total_candidates: int
    generated_at: datetime
    engine_version: str
    disclaimer: str = (
        "Investigation Priority Score is an analytical aid only and must not be "
        "treated as proof of criminal responsibility. Final decisions must be made "
        "by authorized investigators based on verified evidence and applicable law."
    )

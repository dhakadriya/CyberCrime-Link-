"""Relationship / Graph Schemas"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

VALID_ENTITY_TYPES = {"PERSON", "CASE", "EVIDENCE", "LOCATION", "VEHICLE"}
VALID_RELATIONSHIPS = {
    "FRIEND_OF", "ASSOCIATED_WITH", "OWNER_OF", "WITNESS_TO",
    "RELATED_TO", "LINKED_TO", "SUSPECT_IN", "VICTIM_IN"
}
VALID_STRENGTHS = {"WEAK", "MEDIUM", "STRONG"}


class RelationshipCreate(BaseModel):
    source_type: str
    source_id: str
    target_type: str
    target_id: str
    relationship_type: str
    strength: str = "MEDIUM"
    notes: Optional[str] = Field(None, max_length=1000)
    case_id: Optional[str] = None

    def model_post_init(self, __context):
        if self.source_type not in VALID_ENTITY_TYPES:
            raise ValueError(f"source_type must be one of: {VALID_ENTITY_TYPES}")
        if self.target_type not in VALID_ENTITY_TYPES:
            raise ValueError(f"target_type must be one of: {VALID_ENTITY_TYPES}")
        if self.strength not in VALID_STRENGTHS:
            raise ValueError(f"strength must be one of: {VALID_STRENGTHS}")


class RelationshipResponse(BaseModel):
    id: str
    source_type: str
    source_id: str
    source_label: str
    target_type: str
    target_id: str
    target_label: str
    relationship_type: str
    strength: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GraphNode(BaseModel):
    """React Flow node format"""
    id: str
    type: str  # PERSON, CASE, EVIDENCE, LOCATION, VEHICLE
    label: str
    data: Dict[str, Any] = {}


class GraphEdge(BaseModel):
    """React Flow edge format"""
    id: str
    source: str
    target: str
    label: str
    strength: str


class GraphData(BaseModel):
    """Full graph for React Flow visualization"""
    nodes: List[GraphNode]
    edges: List[GraphEdge]

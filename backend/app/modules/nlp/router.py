"""NLP Entity Extraction Router."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import List, Optional

from app.middleware.auth import require_permission
from app.modules.nlp.extractor import extract_entities, find_possible_duplicates

router = APIRouter(prefix="/nlp", tags=["NLP Intelligence"])


class TextInput(BaseModel):
    text: str = Field(..., min_length=10, max_length=50_000)
    source_label: Optional[str] = Field(None, max_length=200)


class EntityUpdateRequest(BaseModel):
    entity_text: str
    entity_type: str
    status: str  # ACCEPTED | REJECTED | EDITED
    corrected_text: Optional[str] = None
    corrected_type: Optional[str] = None


@router.post("/extract")
async def extract(
    payload: TextInput,
    current_user=Depends(require_permission("CASE_READ")),
):
    """
    Extract entities from investigation text using spaCy NER.
    Results are PENDING — investigator must accept/reject each one.
    """
    entities = extract_entities(payload.text)
    duplicates = find_possible_duplicates(entities)

    entity_counts: dict = {}
    for e in entities:
        entity_counts[e["type"]] = entity_counts.get(e["type"], 0) + 1

    return {
        "entities": entities,
        "total": len(entities),
        "entity_counts": entity_counts,
        "possible_duplicates": duplicates,
        "disclaimer": (
            "Extracted entities require investigator review before being used "
            "in any investigative record. NLP extraction is not infallible."
        ),
    }


@router.post("/resolve")
async def resolve_entities(
    payload: TextInput,
    current_user=Depends(require_permission("CASE_READ")),
):
    """Return possible duplicate person entities for investigator review."""
    entities = extract_entities(payload.text)
    duplicates = find_possible_duplicates(entities, threshold=0.55)
    return {
        "candidates": duplicates,
        "total_persons_found": len([e for e in entities if e["type"] == "PERSON"]),
        "disclaimer": (
            "Identity resolution is analytical only. Do not merge identities "
            "without human investigator confirmation."
        ),
    }

"""
Investigation Query Engine
──────────────────────────
Natural language query → intent detection → safe graph query → results.

SECURITY: All queries go through intent detection and validated query builders.
No raw user input is passed to the database. No LLM-generated DB queries.

Supported intents:
- find_connections: "Who connects X and Y?" / "connections between A and B"
- khop_neighbors: "People within 2 degrees of X" / "network around X"
- shortest_path: "Path between X and Y" / "how are X and Y connected"
- search_person: "Find X" / "show X"
- case_summary: "Show case X" / "summary of case X"
- list_suspects: "Suspects in case X"
- anomalies: "anomalies" / "suspicious patterns"
- influencers: "influencers" / "most connected" / "network hubs"
- communities: "communities" / "groups" / "clusters"
"""
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_permission
from app.models.case import Case
from app.models.person import Person, CasePerson
from app.models.relationship import Relationship
from app.models.user import User
from app.modules.network_analysis.engine import (
    compute_network_stats, shortest_path, k_hop_neighbors,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/query", tags=["Investigation Query"])

DISCLAIMER = (
    "Query results are based on recorded investigation data. "
    "They are analytical aids and do not constitute evidence of criminal activity."
)


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)
    case_id: Optional[str] = None


# ── Intent patterns (ordered by specificity) ─────────────────────────────────
_INTENT_PATTERNS = [
    ("shortest_path",  re.compile(r"(?:shortest\s+)?path\s+between|how\s+(?:are|is)\s+(.+?)\s+(?:and|connected\s+to)\s+(.+?)(?:\s+connected)?", re.I)),
    ("find_connections", re.compile(r"(?:who|what)\s+connects?\s+(.+?)\s+(?:and|to)\s+(.+)|connections?\s+between\s+(.+?)\s+and\s+(.+)", re.I)),
    ("khop_neighbors",   re.compile(r"(?:within|around|near|degrees?\s+of)\s+(.+)|network\s+(?:of|around)\s+(.+)|neighbors?\s+of\s+(.+)", re.I)),
    ("list_suspects",    re.compile(r"suspects?\s+(?:in\s+)?(?:case\s+)?(.+)|(?:case\s+)?(.+?)\s+suspects?", re.I)),
    ("case_summary",     re.compile(r"(?:show|summary\s+of|about)\s+case\s+(.+)|case\s+(\w+-\d+-\d+)", re.I)),
    ("influencers",      re.compile(r"influencers?|most\s+connected|network\s+hubs?|key\s+(?:persons?|nodes?)", re.I)),
    ("communities",      re.compile(r"communit(?:y|ies)|groups?|clusters?|network\s+groups?", re.I)),
    ("anomalies",        re.compile(r"anomal(?:y|ies)|suspicious|unusual\s+patterns?|bridge\s+nodes?", re.I)),
    ("search_person",    re.compile(r"(?:find|show|who\s+is|tell\s+me\s+about)\s+(.+)", re.I)),
]


def detect_intent(query: str) -> Dict[str, Any]:
    """Detect query intent and extract named entities from natural language."""
    query_lower = query.lower().strip()
    for intent, pattern in _INTENT_PATTERNS:
        m = pattern.search(query)
        if m:
            groups = [g.strip() for g in m.groups() if g and g.strip()]
            return {"intent": intent, "entities": groups, "raw": query}
    return {"intent": "general_search", "entities": [], "raw": query}


async def _find_person_by_name(db: AsyncSession, name: str) -> Optional[Person]:
    """Find a person by partial name match."""
    parts = name.strip().split()
    if not parts:
        return None
    # Try full name first
    result = await db.execute(
        select(Person).where(
            or_(
                (Person.first_name + " " + Person.last_name).ilike(f"%{name}%"),
                Person.alias.ilike(f"%{name}%"),
            )
        ).limit(1)
    )
    person = result.scalar_one_or_none()
    if person:
        return person
    # Try first name or last name
    result = await db.execute(
        select(Person).where(
            or_(
                Person.first_name.ilike(f"%{parts[0]}%"),
                Person.last_name.ilike(f"%{parts[-1]}%"),
            )
        ).limit(1)
    )
    return result.scalar_one_or_none()


@router.post("")
async def execute_query(
    payload: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
):
    """
    Execute an investigation query using natural language.
    
    Intent is detected, validated, and translated to safe pre-defined
    query templates. No raw user input is passed to the database.
    """
    intent_data = detect_intent(payload.query)
    intent = intent_data["intent"]
    entities = intent_data["entities"]

    result_data: Dict[str, Any] = {
        "query": payload.query,
        "intent": intent,
        "entities_detected": entities,
        "disclaimer": DISCLAIMER,
        "results": [],
    }

    # ── Handle each intent ────────────────────────────────────────────────
    if intent == "shortest_path" and len(entities) >= 2:
        p1 = await _find_person_by_name(db, entities[0])
        p2 = await _find_person_by_name(db, entities[1])
        if p1 and p2:
            path_result = await shortest_path(db, p1.id, p2.id)
            result_data["results"] = [path_result]
            result_data["result_type"] = "PATH"
            result_data["summary"] = (
                f"Shortest path between {p1.full_name} and {p2.full_name}: "
                f"{path_result.get('length', 'N/A')} hop(s)"
                if path_result.get("found") else
                f"No direct path found between {p1.full_name} and {p2.full_name}"
            )
        else:
            names_not_found = []
            if not p1: names_not_found.append(entities[0])
            if not p2: names_not_found.append(entities[1] if len(entities) > 1 else "")
            result_data["summary"] = f"Could not find persons: {', '.join(names_not_found)}"

    elif intent == "find_connections" and len(entities) >= 2:
        p1 = await _find_person_by_name(db, entities[0])
        p2 = await _find_person_by_name(db, entities[1])
        if p1 and p2:
            path_result = await shortest_path(db, p1.id, p2.id)
            # Also get k-hop to show intermediate nodes
            neighbors = await k_hop_neighbors(db, p1.id, k=3)
            result_data["results"] = [{"path": path_result, "neighbors": neighbors}]
            result_data["result_type"] = "CONNECTION"
            if path_result.get("found"):
                intermediate = [n["label"] for n in path_result.get("path", [])[1:-1]]
                result_data["summary"] = (
                    f"{p1.full_name} and {p2.full_name} are connected through: "
                    f"{', '.join(intermediate) if intermediate else 'direct connection'} "
                    f"({path_result['length']} hop(s))"
                )
            else:
                result_data["summary"] = f"No recorded connection found between {p1.full_name} and {p2.full_name}"
        else:
            result_data["summary"] = "Could not identify the persons in your query"

    elif intent == "khop_neighbors" and entities:
        person_name = entities[0]
        person = await _find_person_by_name(db, person_name)
        if person:
            neighbors = await k_hop_neighbors(db, person.id, k=2)
            result_data["results"] = [neighbors]
            result_data["result_type"] = "NEIGHBORS"
            total_n = neighbors.get("total_neighbors", 0)
            result_data["summary"] = (
                f"{person.full_name} has {total_n} entity(ies) within 2 degrees of connection"
            )
        else:
            result_data["summary"] = f"Could not find person: {person_name}"

    elif intent == "influencers":
        network = await compute_network_stats(db, case_id=payload.case_id)
        top_influencers = network.get("influencers", [])[:5]
        result_data["results"] = top_influencers
        result_data["result_type"] = "INFLUENCERS"
        if top_influencers:
            top = top_influencers[0]
            result_data["summary"] = (
                f"Top network influencer: {top['label']} "
                f"(influence score: {top['influence_score']:.1f}/100, "
                f"degree: {top['degree']}, "
                f"betweenness: {top['betweenness_centrality']:.3f})"
            )
        else:
            result_data["summary"] = "No network data available"

    elif intent == "communities":
        network = await compute_network_stats(db, case_id=payload.case_id)
        communities = network.get("communities", [])
        result_data["results"] = communities
        result_data["result_type"] = "COMMUNITIES"
        result_data["summary"] = (
            f"Detected {len(communities)} network communities with "
            f"{network.get('nodes', 0)} total nodes"
        )

    elif intent == "anomalies":
        network = await compute_network_stats(db, case_id=payload.case_id)
        anomalies = network.get("anomalies", [])
        result_data["results"] = anomalies
        result_data["result_type"] = "ANOMALIES"
        result_data["summary"] = (
            f"Detected {len(anomalies)} network anomaly(ies) requiring investigative attention"
        )

    elif intent == "list_suspects" and entities:
        case_ref = entities[0]
        case = (await db.execute(
            select(Case).where(
                or_(
                    Case.case_number.ilike(f"%{case_ref}%"),
                    Case.title.ilike(f"%{case_ref}%"),
                )
            ).limit(1)
        )).scalar_one_or_none()

        if case:
            cp_result = await db.execute(
                select(CasePerson, Person)
                .join(Person, Person.id == CasePerson.person_id)
                .where(
                    CasePerson.case_id == case.id,
                    CasePerson.role == "SUSPECT",
                    CasePerson.is_active == True,
                )
            )
            suspects = [
                {"person_id": p.id, "name": p.full_name, "role": cp.role}
                for cp, p in cp_result.all()
            ]
            result_data["results"] = suspects
            result_data["result_type"] = "PERSONS"
            result_data["summary"] = (
                f"Found {len(suspects)} suspect(s) in {case.case_number}: {case.title}"
            )
        else:
            result_data["summary"] = f"Could not find case: {case_ref}"

    elif intent == "case_summary" and entities:
        case_ref = entities[0]
        case = (await db.execute(
            select(Case).where(
                or_(
                    Case.case_number.ilike(f"%{case_ref}%"),
                    Case.title.ilike(f"%{case_ref}%"),
                )
            ).limit(1)
        )).scalar_one_or_none()

        if case:
            cp_result = await db.execute(
                select(CasePerson, Person)
                .join(Person, Person.id == CasePerson.person_id)
                .where(CasePerson.case_id == case.id, CasePerson.is_active == True)
            )
            persons_list = [
                {"name": p.full_name, "role": cp.role}
                for cp, p in cp_result.all()
            ]
            result_data["results"] = [{
                "case": {
                    "id": case.id,
                    "case_number": case.case_number,
                    "title": case.title,
                    "status": case.status,
                    "priority": case.priority,
                    "case_type": case.case_type,
                },
                "persons": persons_list,
            }]
            result_data["result_type"] = "CASE"
            result_data["summary"] = (
                f"{case.case_number}: {case.title} — "
                f"Status: {case.status} | Priority: {case.priority} | "
                f"{len(persons_list)} person(s) linked"
            )
        else:
            result_data["summary"] = f"Could not find case: {case_ref}"

    elif intent == "search_person" and entities:
        person_name = entities[0]
        persons_result = await db.execute(
            select(Person).where(
                or_(
                    (Person.first_name + " " + Person.last_name).ilike(f"%{person_name}%"),
                    Person.alias.ilike(f"%{person_name}%"),
                )
            ).limit(10)
        )
        persons = persons_result.scalars().all()
        persons_data = []
        for p in persons:
            case_count = (await db.execute(
                select(CasePerson).where(CasePerson.person_id == p.id)
            )).scalars().all()
            rel_count = (await db.execute(
                select(Relationship).where(
                    or_(Relationship.source_id == p.id, Relationship.target_id == p.id)
                )
            )).scalars().all()
            persons_data.append({
                "id": p.id,
                "full_name": p.full_name,
                "alias": p.alias,
                "occupation": p.occupation,
                "phone": p.phone,
                "address": p.address,
                "case_count": len(case_count),
                "relationship_count": len(rel_count),
                "roles": list({cp.role for cp in case_count}),
            })
        result_data["results"] = persons_data
        result_data["result_type"] = "PERSONS"
        result_data["summary"] = (
            f"Found {len(persons_data)} person(s) matching '{person_name}'"
        )

    else:
        # General search fallback
        search_term = payload.query
        persons_result = await db.execute(
            select(Person).where(
                or_(
                    (Person.first_name + " " + Person.last_name).ilike(f"%{search_term}%"),
                    Person.alias.ilike(f"%{search_term}%"),
                    Person.notes.ilike(f"%{search_term}%"),
                )
            ).limit(10)
        )
        persons = persons_result.scalars().all()

        cases_result = await db.execute(
            select(Case).where(
                or_(
                    Case.title.ilike(f"%{search_term}%"),
                    Case.case_number.ilike(f"%{search_term}%"),
                    Case.description.ilike(f"%{search_term}%"),
                )
            ).limit(5)
        )
        cases = cases_result.scalars().all()

        result_data["results"] = {
            "persons": [{"id": p.id, "name": p.full_name, "alias": p.alias} for p in persons],
            "cases": [{"id": c.id, "case_number": c.case_number, "title": c.title} for c in cases],
        }
        result_data["result_type"] = "GENERAL"
        result_data["summary"] = (
            f"Search results: {len(persons)} person(s), {len(cases)} case(s)"
        )

    # Audit log
    await log_action(
        db, "QUERY_EXECUTED",
        user_id=current_user.id, username=current_user.username,
        details={
            "query": payload.query[:200],
            "intent": intent,
            "result_type": result_data.get("result_type"),
        },
    )

    return result_data


@router.get("/suggestions")
async def get_query_suggestions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
):
    """Return sample investigation queries for the UI."""
    # Get real person names for suggestions
    persons = (await db.execute(select(Person).limit(5))).scalars().all()
    cases = (await db.execute(select(Case).limit(3))).scalars().all()

    person_names = [p.full_name for p in persons]
    case_numbers = [c.case_number for c in cases]

    suggestions = [
        "Show network influencers",
        "Find all network anomalies",
        "Show detected communities",
    ]

    if len(person_names) >= 2:
        suggestions.append(f"Who connects {person_names[0]} and {person_names[1]}?")
        suggestions.append(f"Show people within 2 degrees of {person_names[0]}")
        suggestions.append(f"Find path between {person_names[0]} and {person_names[-1]}")

    if person_names:
        suggestions.append(f"Find {person_names[0]}")

    if case_numbers:
        suggestions.append(f"Suspects in {case_numbers[0]}")
        suggestions.append(f"Summary of case {case_numbers[0]}")

    return {"suggestions": suggestions}

"""Relationships / Graph Router"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_permission
from app.models.relationship import Relationship
from app.models.person import Person
from app.models.case import Case
from app.models.user import User
from app.schemas.relationship import (
    RelationshipCreate, RelationshipResponse, GraphData, GraphNode, GraphEdge,
)
from app.services.audit_service import log_action

router = APIRouter(tags=["Relationships"])
relationships_sub = APIRouter(prefix="/relationships", tags=["Relationships"])


@router.get(
    "/cases/{case_id}/relationships/graph",
    response_model=GraphData,
    summary="Get relationship graph for a case",
)
async def get_case_graph(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
) -> GraphData:
    """
    Returns node/edge data for React Flow visualization.
    Includes all persons, evidence, and relationships for this case.
    """
    # Get all relationships in this case
    result = await db.execute(
        select(Relationship).where(Relationship.case_id == case_id)
    )
    rels = result.scalars().all()

    # Get all persons in this case
    from app.models.person import CasePerson
    cp_result = await db.execute(
        select(CasePerson).where(CasePerson.case_id == case_id, CasePerson.is_active == True)
    )
    case_persons = cp_result.scalars().all()

    nodes = []
    edges = []
    seen_nodes = set()

    # Add case node
    case = (await db.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
    if case:
        nodes.append(GraphNode(
            id=case_id,
            type="CASE",
            label=case.case_number,
            data={"title": case.title, "status": case.status},
        ))
        seen_nodes.add(case_id)

    # Add person nodes from case_persons
    for cp in case_persons:
        person_id = cp.person_id
        if person_id not in seen_nodes:
            person = (await db.execute(select(Person).where(Person.id == person_id))).scalar_one_or_none()
            if person:
                nodes.append(GraphNode(
                    id=person_id,
                    type="PERSON",
                    label=person.full_name,
                    data={"role": cp.role},
                ))
                seen_nodes.add(person_id)

        # Edge: person → case
        edges.append(GraphEdge(
            id=f"{person_id}-{case_id}-{cp.role}",
            source=person_id,
            target=case_id,
            label=cp.role,
            strength="STRONG",
        ))

    # Add relationship edges
    for rel in rels:
        # Ensure source node exists
        if rel.source_id not in seen_nodes and rel.source_type == "PERSON":
            person = (await db.execute(select(Person).where(Person.id == rel.source_id))).scalar_one_or_none()
            if person:
                nodes.append(GraphNode(
                    id=rel.source_id, type="PERSON",
                    label=person.full_name, data={},
                ))
                seen_nodes.add(rel.source_id)

        if rel.target_id not in seen_nodes and rel.target_type == "PERSON":
            person = (await db.execute(select(Person).where(Person.id == rel.target_id))).scalar_one_or_none()
            if person:
                nodes.append(GraphNode(
                    id=rel.target_id, type="PERSON",
                    label=person.full_name, data={},
                ))
                seen_nodes.add(rel.target_id)

        edges.append(GraphEdge(
            id=rel.id,
            source=rel.source_id,
            target=rel.target_id,
            label=rel.relationship_type.replace("_", " "),
            strength=rel.strength,
        ))

    return GraphData(nodes=nodes, edges=edges)


@router.post(
    "/relationships",
    response_model=RelationshipResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a relationship",
)
async def create_relationship(
    request: Request,
    rel_data: RelationshipCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_UPDATE")),
) -> RelationshipResponse:
    rel = Relationship(
        source_type=rel_data.source_type,
        source_id=rel_data.source_id,
        target_type=rel_data.target_type,
        target_id=rel_data.target_id,
        relationship_type=rel_data.relationship_type,
        strength=rel_data.strength,
        notes=rel_data.notes,
        case_id=rel_data.case_id,
        created_by=current_user.id,
    )
    db.add(rel)
    await db.commit()

    await log_action(
        db, "RELATIONSHIP_CREATED",
        user_id=current_user.id, username=current_user.username,
        resource_type="RELATIONSHIP", resource_id=rel.id,
        request=request,
    )

    # Resolve labels
    source_label = await _resolve_label(rel_data.source_type, rel_data.source_id, db)
    target_label = await _resolve_label(rel_data.target_type, rel_data.target_id, db)

    return RelationshipResponse(
        id=rel.id,
        source_type=rel.source_type,
        source_id=rel.source_id,
        source_label=source_label,
        target_type=rel.target_type,
        target_id=rel.target_id,
        target_label=target_label,
        relationship_type=rel.relationship_type,
        strength=rel.strength,
        notes=rel.notes,
        created_at=rel.created_at,
    )


@router.delete("/relationships/{relationship_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_relationship(
    request: Request,
    relationship_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_UPDATE")),
) -> None:
    rel = (await db.execute(
        select(Relationship).where(Relationship.id == relationship_id)
    )).scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")

    await db.delete(rel)
    await db.commit()


async def _resolve_label(entity_type: str, entity_id: str, db: AsyncSession) -> str:
    if entity_type == "PERSON":
        p = (await db.execute(select(Person).where(Person.id == entity_id))).scalar_one_or_none()
        return p.full_name if p else entity_id
    if entity_type == "CASE":
        c = (await db.execute(select(Case).where(Case.id == entity_id))).scalar_one_or_none()
        return c.case_number if c else entity_id
    return entity_id

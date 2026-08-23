"""
Entities Router — Aggregated entity view across persons, locations, vehicles.
Provides a unified entity browser for the investigation platform.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_permission
from app.models.person import Person, CasePerson
from app.models.location import Location
from app.models.vehicle import Vehicle
from app.models.relationship import Relationship
from app.models.user import User

router = APIRouter(prefix="/entities", tags=["Entities"])


@router.get("")
async def list_entities(
    entity_type: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    size: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
):
    """
    Unified entity list — persons, locations, vehicles.
    Each entity shows its type, name, case count, and relationship count.
    """
    entities = []

    if not entity_type or entity_type == "PERSON":
        q = select(Person)
        if search:
            q = q.where(or_(
                Person.first_name.ilike(f"%{search}%"),
                Person.last_name.ilike(f"%{search}%"),
                Person.alias.ilike(f"%{search}%"),
                Person.phone.ilike(f"%{search}%"),
            ))
        persons = (await db.execute(q)).scalars().all()
        for p in persons:
            # Count cases
            case_count = (await db.execute(
                select(func.count(CasePerson.id))
                .where(CasePerson.person_id == p.id, CasePerson.is_active == True)
            )).scalar() or 0
            # Count relationships
            rel_count = (await db.execute(
                select(func.count(Relationship.id))
                .where(or_(
                    Relationship.source_id == p.id,
                    Relationship.target_id == p.id,
                ))
            )).scalar() or 0
            entities.append({
                "id": p.id,
                "type": "PERSON",
                "name": p.full_name,
                "alias": p.alias,
                "sub_info": p.occupation or "",
                "contact": p.phone or "",
                "address": p.address or "",
                "case_count": case_count,
                "relationship_count": rel_count,
                "created_at": p.created_at.isoformat(),
                "notes": p.notes or "",
            })

    if not entity_type or entity_type == "LOCATION":
        q = select(Location)
        if search:
            q = q.where(or_(
                Location.name.ilike(f"%{search}%"),
                Location.address.ilike(f"%{search}%"),
            ))
        locs = (await db.execute(q)).scalars().all()
        for loc in locs:
            entities.append({
                "id": loc.id,
                "type": "LOCATION",
                "name": loc.name,
                "alias": None,
                "sub_info": f"Lat: {loc.latitude}, Lng: {loc.longitude}" if loc.latitude else "",
                "contact": "",
                "address": loc.address or "",
                "case_count": 0,
                "relationship_count": 0,
                "created_at": loc.created_at.isoformat(),
                "notes": loc.notes or "",
            })

    if not entity_type or entity_type == "VEHICLE":
        q = select(Vehicle)
        if search:
            q = q.where(or_(
                Vehicle.license_plate.ilike(f"%{search}%"),
                Vehicle.make.ilike(f"%{search}%"),
                Vehicle.model.ilike(f"%{search}%"),
            ))
        vehicles = (await db.execute(q)).scalars().all()
        for v in vehicles:
            entities.append({
                "id": v.id,
                "type": "VEHICLE",
                "name": f"{v.year or ''} {v.make or ''} {v.model or ''}".strip() or "Unknown Vehicle",
                "alias": v.license_plate,
                "sub_info": v.color or "",
                "contact": v.license_plate or "",
                "address": "",
                "case_count": 0,
                "relationship_count": 0,
                "created_at": v.created_at.isoformat(),
                "notes": v.notes or "",
            })

    # Sort by name
    entities.sort(key=lambda x: x["name"].lower())

    # Paginate
    total = len(entities)
    start = (page - 1) * size
    paginated = entities[start:start + size]

    return {
        "items": paginated,
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, (total + size - 1) // size),
    }


@router.get("/stats")
async def get_entity_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
):
    """Entity type summary counts."""
    total_persons = (await db.execute(select(func.count(Person.id)))).scalar() or 0
    total_locations = (await db.execute(select(func.count(Location.id)))).scalar() or 0
    total_vehicles = (await db.execute(select(func.count(Vehicle.id)))).scalar() or 0
    total_relationships = (await db.execute(select(func.count(Relationship.id)))).scalar() or 0

    suspects = (await db.execute(
        select(func.count(func.distinct(CasePerson.person_id)))
        .where(CasePerson.role == "SUSPECT", CasePerson.is_active == True)
    )).scalar() or 0

    victims = (await db.execute(
        select(func.count(func.distinct(CasePerson.person_id)))
        .where(CasePerson.role == "VICTIM", CasePerson.is_active == True)
    )).scalar() or 0

    return {
        "persons": total_persons,
        "locations": total_locations,
        "vehicles": total_vehicles,
        "relationships": total_relationships,
        "suspects": suspects,
        "victims": victims,
        "total": total_persons + total_locations + total_vehicles,
    }

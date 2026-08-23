"""
Geospatial Intelligence Router
───────────────────────────────
Provides location data for mapping:
- Crime locations (from cases)
- Person locations (from addresses — geocoded on the fly)
- Investigation events with locations

Note: We derive coordinates from synthetic location data.
No real geolocation services are called.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_permission
from app.models.case import Case
from app.models.person import Person, CasePerson
from app.models.investigation import InvestigationEvent
from app.models.location import Location
from app.models.user import User

router = APIRouter(prefix="/geospatial", tags=["Geospatial Intelligence"])

# Synthetic city coordinates for demo data
# These match the seed data locations
SYNTHETIC_LOCATIONS = {
    "synthfield": (21.1458, 79.0882),  # Nagpur-ish synthetic
    "portview": (18.9667, 72.8333),    # Mumbai-ish synthetic
    "irontown": (28.6139, 77.2090),    # Delhi-ish synthetic
    "commerce street": (21.1458, 79.0882),
    "finance district": (21.1500, 79.0900),
    "harbour road": (18.9700, 72.8400),
    "garage lane": (28.6150, 77.2100),
    "club row": (18.9750, 72.8450),
    "merchant lane": (21.1420, 79.0850),
    "mg road": (12.9716, 77.5946),    # Bangalore-ish
    "indore": (22.7196, 75.8577),
    "northgate": (21.1480, 79.0860),
    "riverside": (21.1440, 79.0870),
}


def _derive_coords(location_text: str) -> Optional[tuple]:
    """Derive approximate coordinates from location text for demo."""
    if not location_text:
        return None
    text_lower = location_text.lower()
    for key, coords in SYNTHETIC_LOCATIONS.items():
        if key in text_lower:
            # Add small random-looking offset for distinct markers
            # Use hash for determinism
            h = hash(location_text) % 1000
            offset_lat = (h % 50 - 25) * 0.001
            offset_lng = ((h // 50) % 50 - 25) * 0.001
            return (coords[0] + offset_lat, coords[1] + offset_lng)
    return None


@router.get("/locations")
async def get_map_locations(
    case_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
):
    """
    Get all mappable locations for the investigation.
    Returns GeoJSON-compatible point features.
    """
    features = []

    # ── Case locations ──────────────────────────────────────────────────
    q = select(Case)
    if case_id:
        q = q.where(Case.id == case_id)
    cases = (await db.execute(q)).scalars().all()

    for case in cases:
        if case.location:
            coords = _derive_coords(case.location)
            if coords:
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [coords[1], coords[0]],  # [lng, lat]
                    },
                    "properties": {
                        "id": case.id,
                        "feature_type": "CASE",
                        "name": case.case_number,
                        "title": case.title,
                        "location_text": case.location,
                        "status": case.status,
                        "priority": case.priority,
                        "case_type": case.case_type,
                        "marker_color": {
                            "CRITICAL": "#ef4444",
                            "HIGH": "#f97316",
                            "MEDIUM": "#f59e0b",
                            "LOW": "#10b981",
                        }.get(case.priority, "#6366f1"),
                    },
                })

    # ── Person locations ─────────────────────────────────────────────────
    persons_q = select(Person)
    if case_id:
        persons_q = (
            select(Person)
            .join(CasePerson, CasePerson.person_id == Person.id)
            .where(CasePerson.case_id == case_id, CasePerson.is_active == True)
        )
    persons = (await db.execute(persons_q)).scalars().all()

    seen_persons = set()
    for person in persons:
        if person.id in seen_persons:
            continue
        seen_persons.add(person.id)
        if person.address:
            coords = _derive_coords(person.address)
            if coords:
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [coords[1], coords[0]],
                    },
                    "properties": {
                        "id": person.id,
                        "feature_type": "PERSON",
                        "name": person.full_name,
                        "title": person.full_name,
                        "location_text": person.address,
                        "alias": person.alias,
                        "occupation": person.occupation,
                        "phone": person.phone,
                        "marker_color": "#6366f1",
                    },
                })

    # ── Stored locations ─────────────────────────────────────────────────
    stored_locs = (await db.execute(select(Location))).scalars().all()
    for loc in stored_locs:
        if loc.latitude and loc.longitude:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(loc.longitude), float(loc.latitude)],
                },
                "properties": {
                    "id": loc.id,
                    "feature_type": "LOCATION",
                    "name": loc.name,
                    "title": loc.name,
                    "location_text": loc.address or loc.name,
                    "marker_color": "#10b981",
                },
            })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    # Summary stats for the UI
    stats = {
        "total_features": len(features),
        "case_locations": sum(1 for f in features if f["properties"]["feature_type"] == "CASE"),
        "person_locations": sum(1 for f in features if f["properties"]["feature_type"] == "PERSON"),
        "stored_locations": sum(1 for f in features if f["properties"]["feature_type"] == "LOCATION"),
    }

    return {
        "geojson": geojson,
        "stats": stats,
        "disclaimer": (
            "Locations shown are derived from investigation records. "
            "Coordinates are approximate for synthetic demo data."
        ),
    }


@router.get("/heatmap")
async def get_heatmap_data(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
):
    """
    Heatmap data — intensity points based on case/event density.
    """
    points = []
    cases = (await db.execute(select(Case))).scalars().all()

    for case in cases:
        if case.location:
            coords = _derive_coords(case.location)
            if coords:
                weight = {
                    "CRITICAL": 1.0,
                    "HIGH": 0.7,
                    "MEDIUM": 0.4,
                    "LOW": 0.2,
                }.get(case.priority, 0.3)
                points.append({
                    "lat": coords[0],
                    "lng": coords[1],
                    "weight": weight,
                    "label": case.case_number,
                })

    return {"points": points}

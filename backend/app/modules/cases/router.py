"""
Cases Router
─────────────
Full CRUD for investigation cases with IDOR/BOLA protection.

IDOR (Insecure Direct Object Reference) Prevention:
────────────────────────────────────────────────────
Every GET/PUT/DELETE on a specific case checks:
1. Does this case exist?
2. Is this user assigned to it OR are they a supervisor/admin?

If officer A tries to access case B (assigned to officer B):
→ Return 403 Forbidden (or 404 to not reveal existence)

We return 404 for GET (don't reveal case exists)
We return 403 for PUT/DELETE (more informative for authorized users)
"""

import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_permission
from app.models.case import Case, CaseAssignment
from app.models.person import CasePerson, Person
from app.models.evidence import Evidence
from app.models.user import User
from app.schemas.case import (
    CaseCreate, CaseUpdate, CaseResponse, CaseListResponse,
    CaseAssignRequest, CaseStatusUpdate, AssignedOfficerResponse,
    CaseWizardCreate,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/cases", tags=["Cases"])


# ── Counter for generating case numbers ────────────────────────────────────
async def _generate_case_number(db: AsyncSession) -> str:
    """Generate sequential case number: CASE-2026-001"""
    year = datetime.now(timezone.utc).year
    result = await db.execute(
        select(func.count(Case.id)).where(
            Case.case_number.like(f"CASE-{year}-%")
        )
    )
    count = result.scalar() or 0
    return f"CASE-{year}-{count + 1:03d}"


# ── Access control helper ────────────────────────────────────────────────────
async def _get_case_with_access_check(
    case_id: str,
    db: AsyncSession,
    user: User,
    require_write: bool = False,
) -> Case:
    """
    Load a case and verify the user has access.
    
    Access rules:
    - SUPER_ADMIN: access to all cases
    - CASE_SUPERVISOR: access to all cases
    - Others: only assigned cases
    
    Returns 404 (not 403) for unauthorized GET — prevents
    leaking whether a case exists.
    """
    result = await db.execute(
        select(Case)
        .options(selectinload(Case.assignments).selectinload(CaseAssignment.user))
        .where(Case.id == case_id)
    )
    case = result.scalar_one_or_none()

    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    # Super admin and supervisors see all cases
    user_roles = set(user.roles)
    if "SUPER_ADMIN" in user_roles or "CASE_SUPERVISOR" in user_roles:
        return case

    # Check if user is assigned to this case
    assigned_user_ids = {a.user_id for a in case.assignments if a.is_active}
    if user.id not in assigned_user_ids and case.created_by != user.id:
        # For write operations: 403; for reads: 404 (don't reveal existence)
        if require_write:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to modify this case",
            )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")

    return case


def _build_case_response(case: Case, persons_count: int, evidence_count: int) -> CaseResponse:
    officers = [
        AssignedOfficerResponse(
            user_id=a.user_id,
            username=a.user.username if a.user else "",
            full_name=a.user.full_name if a.user else "",
            role=a.role,
            assigned_at=a.assigned_at,
        )
        for a in case.assignments if a.is_active
    ]
    return CaseResponse(
        id=case.id,
        case_number=case.case_number,
        title=case.title,
        case_type=case.case_type,
        description=case.description,
        location=case.location,
        incident_date=case.incident_date,
        status=case.status,
        priority=case.priority,
        created_by=case.created_by,
        created_at=case.created_at,
        updated_at=case.updated_at,
        closed_at=case.closed_at,
        persons_count=persons_count,
        evidence_count=evidence_count,
        assigned_officers=officers,
    )


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=CaseListResponse, summary="List cases with filtering", include_in_schema=False)
@router.get("/", response_model=CaseListResponse, summary="List cases with filtering")
async def list_cases(
    request: Request,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=200),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    priority_filter: Optional[str] = Query(default=None, alias="priority"),
    case_type: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
) -> CaseListResponse:
    """
    List cases with search, filters, and pagination.
    
    - Regular officers only see their assigned cases
    - Supervisors and admins see all cases
    """
    # Base query
    query = select(Case).options(
        selectinload(Case.assignments).selectinload(CaseAssignment.user)
    )

    # Scope by access
    user_roles = set(current_user.roles)
    if "SUPER_ADMIN" not in user_roles and "CASE_SUPERVISOR" not in user_roles:
        # Filter to assigned cases only
        query = query.join(
            CaseAssignment,
            (CaseAssignment.case_id == Case.id) & 
            (CaseAssignment.user_id == current_user.id) & 
            (CaseAssignment.is_active == True)
        )

    # Search
    if search:
        query = query.where(
            or_(
                Case.title.ilike(f"%{search}%"),
                Case.case_number.ilike(f"%{search}%"),
                Case.description.ilike(f"%{search}%"),
            )
        )

    # Filters
    if status_filter:
        query = query.where(Case.status == status_filter.upper())
    if priority_filter:
        query = query.where(Case.priority == priority_filter.upper())
    if case_type:
        query = query.where(Case.case_type == case_type.upper())

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Paginate
    offset = (page - 1) * size
    query = query.order_by(Case.created_at.desc()).offset(offset).limit(size)
    cases_result = await db.execute(query)
    cases = cases_result.scalars().unique().all()

    # Build responses with counts
    items = []
    for case in cases:
        p_count = await db.execute(
            select(func.count(CasePerson.id)).where(
                CasePerson.case_id == case.id, CasePerson.is_active == True
            )
        )
        e_count = await db.execute(
            select(func.count(Evidence.id)).where(Evidence.case_id == case.id)
        )
        items.append(_build_case_response(
            case, p_count.scalar() or 0, e_count.scalar() or 0
        ))

    return CaseListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.post(
    "/",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new investigation case",
)
async def create_case(
    request: Request,
    case_data: CaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_CREATE")),
) -> CaseResponse:
    case_number = await _generate_case_number(db)

    case = Case(
        case_number=case_number,
        title=case_data.title,
        case_type=case_data.case_type.upper(),
        description=case_data.description,
        location=case_data.location,
        incident_date=case_data.incident_date,
        priority=case_data.priority.upper(),
        status="OPEN",
        created_by=current_user.id,
    )
    db.add(case)
    await db.flush()  # Get ID without committing

    # Auto-assign creator as lead investigator
    assignment = CaseAssignment(
        case_id=case.id,
        user_id=current_user.id,
        role="LEAD_INVESTIGATOR",
        assigned_by=current_user.id,
    )
    db.add(assignment)

    # Create investigation timeline event
    from app.models.investigation import InvestigationEvent
    event = InvestigationEvent(
        case_id=case.id,
        event_type="CASE_CREATED",
        title=f"Case {case_number} created",
        description=f"Investigation case '{case_data.title}' opened",
        created_by=current_user.id,
    )
    db.add(event)

    await db.commit()
    await db.refresh(case)

    await log_action(
        db, "CASE_CREATED",
        user_id=current_user.id,
        username=current_user.username,
        resource_type="CASE",
        resource_id=case.id,
        details={"case_number": case_number, "title": case_data.title},
        request=request,
    )

    return _build_case_response(case, 0, 0)


@router.get("/{case_id}", response_model=CaseResponse, summary="Get case details")
async def get_case(
    request: Request,
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
) -> CaseResponse:
    case = await _get_case_with_access_check(case_id, db, current_user)

    p_count = await db.execute(
        select(func.count(CasePerson.id)).where(
            CasePerson.case_id == case.id, CasePerson.is_active == True
        )
    )
    e_count = await db.execute(
        select(func.count(Evidence.id)).where(Evidence.case_id == case.id)
    )

    await log_action(
        db, "CASE_VIEWED",
        user_id=current_user.id, username=current_user.username,
        resource_type="CASE", resource_id=case.id,
        request=request,
    )

    return _build_case_response(case, p_count.scalar() or 0, e_count.scalar() or 0)


@router.put("/{case_id}", response_model=CaseResponse, summary="Update case")
async def update_case(
    request: Request,
    case_id: str,
    update_data: CaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_UPDATE")),
) -> CaseResponse:
    case = await _get_case_with_access_check(case_id, db, current_user, require_write=True)

    updated_fields = {}
    if update_data.title is not None:
        case.title = update_data.title
        updated_fields["title"] = update_data.title
    if update_data.case_type is not None:
        case.case_type = update_data.case_type.upper()
        updated_fields["case_type"] = case.case_type
    if update_data.description is not None:
        case.description = update_data.description
    if update_data.location is not None:
        case.location = update_data.location
    if update_data.incident_date is not None:
        case.incident_date = update_data.incident_date
    if update_data.priority is not None:
        case.priority = update_data.priority.upper()
        updated_fields["priority"] = case.priority

    case.updated_at = datetime.now(timezone.utc)

    # Timeline event
    from app.models.investigation import InvestigationEvent
    event = InvestigationEvent(
        case_id=case.id,
        event_type="CASE_UPDATED",
        title="Case details updated",
        description=f"Updated fields: {', '.join(updated_fields.keys())}",
        created_by=current_user.id,
    )
    db.add(event)

    await db.commit()
    await db.refresh(case)

    await log_action(
        db, "CASE_UPDATED",
        user_id=current_user.id, username=current_user.username,
        resource_type="CASE", resource_id=case.id,
        details=updated_fields, request=request,
    )

    p_count = await db.execute(
        select(func.count(CasePerson.id)).where(CasePerson.case_id == case.id, CasePerson.is_active == True)
    )
    e_count = await db.execute(
        select(func.count(Evidence.id)).where(Evidence.case_id == case.id)
    )
    return _build_case_response(case, p_count.scalar() or 0, e_count.scalar() or 0)


@router.put("/{case_id}/status", response_model=CaseResponse, summary="Update case status")
async def update_case_status(
    request: Request,
    case_id: str,
    status_data: CaseStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_UPDATE")),
) -> CaseResponse:
    case = await _get_case_with_access_check(case_id, db, current_user, require_write=True)

    old_status = case.status
    case.status = status_data.status

    if status_data.status in ("CLOSED", "SOLVED"):
        case.closed_at = datetime.now(timezone.utc)
    if status_data.status == "ARCHIVED":
        case.archived_at = datetime.now(timezone.utc)

    from app.models.investigation import InvestigationEvent
    event = InvestigationEvent(
        case_id=case.id,
        event_type="STATUS_CHANGED",
        title=f"Case status changed: {old_status} → {status_data.status}",
        description=status_data.reason,
        created_by=current_user.id,
    )
    db.add(event)

    await db.commit()
    await db.refresh(case)

    await log_action(
        db, "CASE_STATUS_CHANGED",
        user_id=current_user.id, username=current_user.username,
        resource_type="CASE", resource_id=case.id,
        details={"old_status": old_status, "new_status": status_data.status},
        request=request,
    )

    p_count = await db.execute(
        select(func.count(CasePerson.id)).where(CasePerson.case_id == case.id, CasePerson.is_active == True)
    )
    e_count = await db.execute(
        select(func.count(Evidence.id)).where(Evidence.case_id == case.id)
    )
    return _build_case_response(case, p_count.scalar() or 0, e_count.scalar() or 0)


@router.post("/{case_id}/assign", summary="Assign officer to case")
async def assign_officer(
    request: Request,
    case_id: str,
    assign_data: CaseAssignRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_ASSIGN")),
) -> dict:
    case = await _get_case_with_access_check(case_id, db, current_user, require_write=True)

    # Check if already assigned
    existing = await db.execute(
        select(CaseAssignment).where(
            CaseAssignment.case_id == case_id,
            CaseAssignment.user_id == assign_data.user_id,
        )
    )
    existing_assignment = existing.scalar_one_or_none()

    if existing_assignment:
        existing_assignment.is_active = True
        existing_assignment.role = assign_data.role
        existing_assignment.removed_at = None
    else:
        assignment = CaseAssignment(
            case_id=case_id,
            user_id=assign_data.user_id,
            role=assign_data.role,
            assigned_by=current_user.id,
        )
        db.add(assignment)

    from app.models.investigation import InvestigationEvent
    event = InvestigationEvent(
        case_id=case_id,
        event_type="OFFICER_ASSIGNED",
        title=f"Officer assigned to case",
        description=f"Role: {assign_data.role}",
        created_by=current_user.id,
    )
    db.add(event)

    await db.commit()

    await log_action(
        db, "CASE_ASSIGNED",
        user_id=current_user.id, username=current_user.username,
        resource_type="CASE", resource_id=case_id,
        details={"assigned_user": assign_data.user_id, "role": assign_data.role},
        request=request,
    )

    return {"message": "Officer assigned successfully"}


@router.get(
    "/{case_id}/persons",
    summary="Get persons linked to a case",
)
async def get_case_persons(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("PERSON_READ")),
) -> list:
    """Return all active persons linked to this case with their roles."""
    await _get_case_with_access_check(case_id, db, current_user)

    result = await db.execute(
        select(CasePerson)
        .options(selectinload(CasePerson.person))
        .where(CasePerson.case_id == case_id, CasePerson.is_active == True)
        .order_by(CasePerson.role, CasePerson.added_at)
    )
    case_persons = result.scalars().all()

    return [
        {
            "id": cp.id,
            "case_id": cp.case_id,
            "person_id": cp.person_id,
            "person_name": cp.person.full_name if cp.person else "Unknown",
            "role": cp.role,
            "notes": cp.notes,
            "added_at": cp.added_at.isoformat(),
        }
        for cp in case_persons
    ]


# ── Case Wizard — create full case in one transaction ──────────────────────

@router.post(
    "/wizard",
    response_model=CaseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create case via guided wizard (multi-step data in one request)",
)
async def create_case_wizard(
    request: Request,
    wizard_data: "CaseWizardCreate",
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("CASE_CREATE")),
) -> CaseResponse:
    """
    Wizard endpoint: accepts case info + optional persons, relationships,
    and events in a single transaction.
    Evidence must still be uploaded via /evidence/upload (multipart).
    """
    from app.schemas.case import CaseWizardCreate, VALID_PRIORITIES, VALID_STATUSES
    from app.models.person import Person, CasePerson
    from app.models.relationship import Relationship
    from app.models.investigation import InvestigationEvent

    case_number = await _generate_case_number(db)

    case = Case(
        case_number=case_number,
        title=wizard_data.title,
        case_type=wizard_data.case_type.upper(),
        description=wizard_data.description,
        location=wizard_data.location,
        incident_date=wizard_data.incident_date,
        priority=wizard_data.priority.upper(),
        status=wizard_data.status.upper() if wizard_data.status else "OPEN",
        created_by=current_user.id,
    )
    db.add(case)
    await db.flush()

    # Auto-assign creator
    db.add(CaseAssignment(
        case_id=case.id, user_id=current_user.id,
        role="LEAD_INVESTIGATOR", assigned_by=current_user.id,
    ))

    # Case created event
    db.add(InvestigationEvent(
        case_id=case.id, event_type="CASE_CREATED",
        title=f"Case {case_number} created via wizard",
        description=f"Investigation case '{wizard_data.title}' opened",
        created_by=current_user.id,
    ))

    # Step 2: Persons
    person_id_map: dict = {}  # local index → real person id
    for i, p_entry in enumerate(wizard_data.persons):
        if p_entry.existing_person_id:
            # Link existing person
            person_id = p_entry.existing_person_id
        else:
            # Create new person
            from datetime import date
            dob = None
            if p_entry.date_of_birth:
                try:
                    dob = date.fromisoformat(p_entry.date_of_birth)
                except ValueError:
                    pass

            person = Person(
                first_name=p_entry.first_name,
                last_name=p_entry.last_name,
                alias=p_entry.alias,
                date_of_birth=dob,
                gender=p_entry.gender,
                nationality=p_entry.nationality,
                address=p_entry.address,
                phone=p_entry.phone,
                occupation=p_entry.occupation,
                notes=p_entry.notes or "Added via case wizard",
                created_by=current_user.id,
            )
            db.add(person)
            await db.flush()
            person_id = person.id

        person_id_map[i] = person_id
        db.add(CasePerson(
            case_id=case.id,
            person_id=person_id,
            role=p_entry.role.upper() if p_entry.role else "OTHER",
            added_by=current_user.id,
        ))
        db.add(InvestigationEvent(
            case_id=case.id,
            event_type="PERSON_ADDED",
            title=f"{p_entry.role.title() if p_entry.role else 'Person'} added to case",
            description=f"{p_entry.first_name} {p_entry.last_name}",
            created_by=current_user.id,
            related_person=person_id,
        ))

    # Step 4: Relationships
    for rel in wizard_data.relationships:
        db.add(Relationship(
            source_type=rel.source_type,
            source_id=rel.source_id,
            target_type=rel.target_type,
            target_id=rel.target_id,
            relationship_type=rel.relationship_type,
            strength=rel.strength,
            notes=rel.notes,
            case_id=case.id,
            created_by=current_user.id,
        ))

    # Step 5: Events
    for ev in wizard_data.events:
        db.add(InvestigationEvent(
            case_id=case.id,
            event_type=ev.event_type.upper(),
            title=ev.title,
            description=ev.description,
            occurred_at=ev.occurred_at or datetime.now(timezone.utc),
            created_by=current_user.id,
        ))

    await db.commit()
    await db.refresh(case)

    await log_action(
        db, "CASE_CREATED",
        user_id=current_user.id, username=current_user.username,
        resource_type="CASE", resource_id=case.id,
        details={
            "case_number": case_number,
            "title": wizard_data.title,
            "method": "wizard",
            "persons_added": len(wizard_data.persons),
        },
        request=request,
    )

    p_count = len(wizard_data.persons)
    return _build_case_response(case, p_count, 0)


# ── Case Completion Score ────────────────────────────────────────────────────

@router.get(
    "/{case_id}/completion",
    summary="Get case completion percentage (calculated from real DB data)",
)
async def get_case_completion(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("CASE_READ")),
) -> dict:
    """
    Returns a real completion percentage calculated from what exists
    in the database for this case. Never hardcoded.
    """
    from app.models.investigation import InvestigationEvent
    from app.models.relationship import Relationship

    case = await _get_case_with_access_check(case_id, db, current_user)

    p_count_r = await db.execute(
        select(func.count(CasePerson.id)).where(
            CasePerson.case_id == case_id, CasePerson.is_active == True
        )
    )
    e_count_r = await db.execute(
        select(func.count(Evidence.id)).where(Evidence.case_id == case_id)
    )
    rel_count_r = await db.execute(
        select(func.count(Relationship.id)).where(Relationship.case_id == case_id)
    )
    ev_count_r = await db.execute(
        select(func.count(InvestigationEvent.id)).where(
            InvestigationEvent.case_id == case_id
        )
    )

    p_count = p_count_r.scalar() or 0
    e_count = e_count_r.scalar() or 0
    rel_count = rel_count_r.scalar() or 0
    ev_count = ev_count_r.scalar() or 0

    # Weighted completion:
    # Case info (title + type + description + location + incident_date) = 30%
    # Persons                                                            = 20%
    # Evidence                                                           = 20%
    # Relationships                                                      = 15%
    # Investigation events                                               = 15%
    score = 0
    info_score = 10  # title + type always present
    if case.description:
        info_score += 7
    if case.location:
        info_score += 7
    if case.incident_date:
        info_score += 6
    score += min(info_score, 30)
    score += min(p_count * 10, 20)
    score += min(e_count * 10, 20)
    score += min(rel_count * 8, 15)
    score += min(ev_count * 5, 15)

    return {
        "case_id": case_id,
        "percentage": min(score, 100),
        "has_description": bool(case.description),
        "has_location": bool(case.location),
        "has_incident_date": bool(case.incident_date),
        "persons_count": p_count,
        "evidence_count": e_count,
        "relationships_count": rel_count,
        "events_count": ev_count,
    }

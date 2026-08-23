"""Persons Router"""

import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_permission
from app.models.person import Person, CasePerson
from app.models.case import Case
from app.models.user import User
from app.schemas.person import (
    PersonCreate, PersonUpdate, PersonResponse, PersonListResponse,
    CasePersonCreate, CasePersonResponse, PersonCaseHistory,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/persons", tags=["Persons"])


def _build_person_response(person: Person, include_history: bool = False) -> PersonResponse:
    history = []
    if include_history:
        for cp in person.case_persons:
            if cp.case and cp.is_active:
                history.append(PersonCaseHistory(
                    case_id=cp.case_id,
                    case_number=cp.case.case_number,
                    title=cp.case.title,
                    case_type=cp.case.case_type,
                    status=cp.case.status,
                    role=cp.role,
                    added_at=cp.added_at,
                ))
    return PersonResponse(
        id=person.id,
        first_name=person.first_name,
        last_name=person.last_name,
        full_name=person.full_name,
        alias=person.alias,
        date_of_birth=person.date_of_birth,
        gender=person.gender,
        nationality=person.nationality,
        national_id=person.national_id,
        address=person.address,
        phone=person.phone,
        email=person.email,
        occupation=person.occupation,
        notes=person.notes,
        created_at=person.created_at,
        updated_at=person.updated_at,
        case_history=history,
    )


@router.get("", response_model=PersonListResponse, summary="List persons", include_in_schema=False)
@router.get("/", response_model=PersonListResponse, summary="List persons")
async def list_persons(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None, max_length=200),
    role_filter: Optional[str] = Query(default=None, alias="role"),
    case_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("PERSON_READ")),
) -> PersonListResponse:
    query = select(Person).options(
        selectinload(Person.case_persons).selectinload(CasePerson.case)
    )

    if search:
        query = query.where(
            or_(
                Person.first_name.ilike(f"%{search}%"),
                Person.last_name.ilike(f"%{search}%"),
                Person.alias.ilike(f"%{search}%"),
            )
        )

    if case_id:
        query = query.join(CasePerson, CasePerson.person_id == Person.id).where(
            CasePerson.case_id == case_id, CasePerson.is_active == True
        )

    if role_filter:
        if not case_id:
            query = query.join(CasePerson, CasePerson.person_id == Person.id)
        query = query.where(CasePerson.role == role_filter.upper())

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * size
    query = query.order_by(Person.last_name, Person.first_name).offset(offset).limit(size)
    persons = (await db.execute(query)).scalars().unique().all()

    return PersonListResponse(
        items=[_build_person_response(p) for p in persons],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.post(
    "/",
    response_model=PersonResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create person record",
)
async def create_person(
    request: Request,
    person_data: PersonCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("PERSON_CREATE")),
) -> PersonResponse:
    person = Person(
        **person_data.model_dump(exclude_none=True),
        created_by=current_user.id,
    )
    db.add(person)
    await db.commit()
    await db.refresh(person)

    await log_action(
        db, "PERSON_CREATED",
        user_id=current_user.id, username=current_user.username,
        resource_type="PERSON", resource_id=person.id,
        details={"name": person.full_name},
        request=request,
    )

    return _build_person_response(person)


@router.get("/{person_id}", response_model=PersonResponse, summary="Get person details")
async def get_person(
    request: Request,
    person_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("PERSON_READ")),
) -> PersonResponse:
    result = await db.execute(
        select(Person)
        .options(
            selectinload(Person.case_persons).selectinload(CasePerson.case)
        )
        .where(Person.id == person_id)
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    await log_action(
        db, "PERSON_VIEWED",
        user_id=current_user.id, username=current_user.username,
        resource_type="PERSON", resource_id=person_id,
        request=request,
    )

    return _build_person_response(person, include_history=True)


@router.put("/{person_id}", response_model=PersonResponse, summary="Update person")
async def update_person(
    request: Request,
    person_id: str,
    update_data: PersonUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("PERSON_UPDATE")),
) -> PersonResponse:
    result = await db.execute(
        select(Person)
        .options(selectinload(Person.case_persons).selectinload(CasePerson.case))
        .where(Person.id == person_id)
    )
    person = result.scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    for field, value in update_data.model_dump(exclude_none=True).items():
        setattr(person, field, value)
    person.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(person)

    await log_action(
        db, "PERSON_UPDATED",
        user_id=current_user.id, username=current_user.username,
        resource_type="PERSON", resource_id=person_id,
        request=request,
    )

    return _build_person_response(person, include_history=True)


@router.post(
    "/cases/{case_id}/persons",
    response_model=CasePersonResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add person to case",
)
async def add_person_to_case(
    request: Request,
    case_id: str,
    link_data: CasePersonCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("PERSON_CREATE")),
) -> CasePersonResponse:
    # Verify case exists
    case = (await db.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Verify person exists
    person = (await db.execute(select(Person).where(Person.id == link_data.person_id))).scalar_one_or_none()
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    # Check for duplicate
    existing = (await db.execute(
        select(CasePerson).where(
            CasePerson.case_id == case_id,
            CasePerson.person_id == link_data.person_id,
            CasePerson.role == link_data.role,
        )
    )).scalar_one_or_none()

    if existing:
        existing.is_active = True
        await db.commit()
        cp = existing
    else:
        cp = CasePerson(
            case_id=case_id,
            person_id=link_data.person_id,
            role=link_data.role,
            notes=link_data.notes,
            added_by=current_user.id,
        )
        db.add(cp)
        await db.commit()

    # Timeline event
    from app.models.investigation import InvestigationEvent
    event = InvestigationEvent(
        case_id=case_id,
        event_type="PERSON_ADDED",
        title=f"{link_data.role.title()} added to case",
        description=f"{person.full_name} added as {link_data.role}",
        created_by=current_user.id,
        related_person=link_data.person_id,
    )
    db.add(event)
    await db.commit()

    await log_action(
        db, "PERSON_ADDED_TO_CASE",
        user_id=current_user.id, username=current_user.username,
        resource_type="CASE_PERSON", resource_id=case_id,
        details={"person_id": link_data.person_id, "role": link_data.role},
        request=request,
    )

    return CasePersonResponse(
        id=cp.id,
        case_id=cp.case_id,
        person_id=cp.person_id,
        person_name=person.full_name,
        role=cp.role,
        notes=cp.notes,
        added_at=cp.added_at,
    )


# Also expose under /cases/{case_id}/persons for convenience
cases_persons_router = APIRouter(prefix="/cases", tags=["Cases - Persons"])

@cases_persons_router.post(
    "/{case_id}/persons",
    response_model=CasePersonResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_person_to_case_v2(
    request: Request,
    case_id: str,
    link_data: CasePersonCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("PERSON_CREATE")),
) -> CasePersonResponse:
    return await add_person_to_case(request, case_id, link_data, db, current_user)

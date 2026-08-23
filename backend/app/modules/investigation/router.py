"""Investigation Timeline Router"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import get_current_user, require_permission
from app.models.investigation import InvestigationEvent
from app.models.case import Case
from app.models.user import User
from app.models.person import Person
from app.models.evidence import Evidence
from app.schemas.investigation import (
    InvestigationEventCreate, InvestigationEventResponse, TimelineResponse,
)
from app.services.audit_service import log_action

router = APIRouter(tags=["Investigation Timeline"])


@router.get(
    "/cases/{case_id}/timeline",
    response_model=TimelineResponse,
    summary="Get case investigation timeline",
)
async def get_timeline(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
) -> TimelineResponse:
    # Verify case exists (access checked elsewhere)
    case = (await db.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    result = await db.execute(
        select(InvestigationEvent)
        .options(
            selectinload(InvestigationEvent.creator),
            selectinload(InvestigationEvent.person),
            selectinload(InvestigationEvent.evidence),
        )
        .where(InvestigationEvent.case_id == case_id)
        .order_by(InvestigationEvent.occurred_at.desc())
    )
    events = result.scalars().all()

    return TimelineResponse(
        events=[_build_event_response(e) for e in events],
        total=len(events),
    )


@router.post(
    "/cases/{case_id}/events",
    response_model=InvestigationEventResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add investigation event to timeline",
)
async def add_event(
    request: Request,
    case_id: str,
    event_data: InvestigationEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_UPDATE")),
) -> InvestigationEventResponse:
    case = (await db.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    event = InvestigationEvent(
        case_id=case_id,
        event_type=event_data.event_type.upper(),
        title=event_data.title,
        description=event_data.description,
        occurred_at=event_data.occurred_at or datetime.now(timezone.utc),
        created_by=current_user.id,
        related_person=event_data.related_person,
        related_evidence=event_data.related_evidence,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    await db.refresh(event, ["creator", "person", "evidence"])

    await log_action(
        db, "INVESTIGATION_EVENT_ADDED",
        user_id=current_user.id, username=current_user.username,
        resource_type="CASE", resource_id=case_id,
        details={"event_type": event_data.event_type},
        request=request,
    )

    return _build_event_response(event)


def _build_event_response(event: InvestigationEvent) -> InvestigationEventResponse:
    return InvestigationEventResponse(
        id=event.id,
        case_id=event.case_id,
        event_type=event.event_type,
        title=event.title,
        description=event.description,
        occurred_at=event.occurred_at,
        created_by=event.created_by,
        created_by_name=event.creator.full_name if event.creator else None,
        related_person_id=event.related_person,
        related_person_name=event.person.full_name if event.person else None,
        related_evidence_id=event.related_evidence,
        related_evidence_number=event.evidence.evidence_number if event.evidence else None,
        metadata_json=event.metadata_json,
    )

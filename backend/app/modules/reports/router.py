"""Reports Router — Generate investigation reports from real data"""

from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.middleware.auth import require_permission
from app.models.audit import AuditLog
from app.models.case import Case, CaseAssignment
from app.models.evidence import Evidence, EvidenceCustody
from app.models.investigation import InvestigationEvent
from app.models.person import CasePerson, Person
from app.models.scoring import SuspectScore
from app.models.user import User
from app.services.audit_service import log_action

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post(
    "/case/{case_id}",
    summary="Generate full investigation report for a case",
)
async def generate_case_report(
    case_id: str,
    request_obj=None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("REPORT_GENERATE")),
) -> Dict[str, Any]:
    """
    Builds a complete investigation report from database records.
    All data is real — no fabricated content.
    """
    from fastapi import Request
    
    # Load case
    case = (await db.execute(
        select(Case)
        .options(selectinload(Case.assignments).selectinload(CaseAssignment.user))
        .where(Case.id == case_id)
    )).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Persons in this case
    cp_result = await db.execute(
        select(CasePerson, Person)
        .join(Person, Person.id == CasePerson.person_id)
        .where(CasePerson.case_id == case_id, CasePerson.is_active == True)
        .order_by(CasePerson.role)
    )
    case_persons = []
    for cp, person in cp_result.all():
        case_persons.append({
            "person_id": person.id,
            "full_name": person.full_name,
            "alias": person.alias,
            "role": cp.role,
            "notes": cp.notes,
            "added_at": cp.added_at.isoformat(),
        })

    # Evidence
    evid_result = await db.execute(
        select(Evidence)
        .options(
            selectinload(Evidence.uploader),
            selectinload(Evidence.custodian),
        )
        .where(Evidence.case_id == case_id)
        .order_by(Evidence.uploaded_at)
    )
    evidence_list = []
    for e in evid_result.scalars().all():
        evidence_list.append({
            "evidence_number": e.evidence_number,
            "evidence_type": e.evidence_type,
            "description": e.description,
            "original_filename": e.original_filename,
            "mime_type": e.mime_type,
            "file_size_kb": round(e.file_size / 1024, 2),
            "sha256_hash": e.sha256_hash,
            "status": e.status,
            "uploaded_by": e.uploader.full_name if e.uploader else "Unknown",
            "current_custodian": e.custodian.full_name if e.custodian else "Unknown",
            "uploaded_at": e.uploaded_at.isoformat(),
        })

    # Timeline (last 50 events)
    timeline_result = await db.execute(
        select(InvestigationEvent)
        .options(selectinload(InvestigationEvent.creator))
        .where(InvestigationEvent.case_id == case_id)
        .order_by(InvestigationEvent.occurred_at.asc())
        .limit(50)
    )
    timeline = []
    for ev in timeline_result.scalars().all():
        timeline.append({
            "event_type": ev.event_type,
            "title": ev.title,
            "description": ev.description,
            "occurred_at": ev.occurred_at.isoformat(),
            "recorded_by": ev.creator.full_name if ev.creator else "System",
        })

    # Prioritization scores
    scores_result = await db.execute(
        select(SuspectScore, Person)
        .join(Person, Person.id == SuspectScore.person_id)
        .where(SuspectScore.case_id == case_id, SuspectScore.is_latest == True)
        .order_by(SuspectScore.score.desc())
    )
    scores = []
    for score, person in scores_result.all():
        scores.append({
            "person_name": person.full_name,
            "score": float(score.score),
            "contributing_factors": score.contributing_factors,
            "engine_version": score.engine_version,
            "generated_at": score.generated_at.isoformat(),
        })

    # Recent audit events for this case (last 20)
    audit_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.resource_type == "CASE", AuditLog.resource_id == case_id)
        .order_by(AuditLog.created_at.desc())
        .limit(20)
    )
    audit_events = []
    for log in audit_result.scalars().all():
        audit_events.append({
            "action": log.action,
            "username": log.username,
            "result": log.result,
            "created_at": log.created_at.isoformat(),
        })

    # Assigned officers
    officers = [
        {
            "full_name": a.user.full_name if a.user else "Unknown",
            "username": a.user.username if a.user else "Unknown",
            "role": a.role,
            "assigned_at": a.assigned_at.isoformat(),
        }
        for a in case.assignments if a.is_active
    ]

    report = {
        "report_type": "INVESTIGATION_CASE_REPORT",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "generated_by": current_user.full_name,
        "disclaimer": (
            "This report is for authorized investigative use only. "
            "Investigation Priority Scores are analytical aids and must not be treated "
            "as proof of criminal responsibility."
        ),
        "environment": "DEMO — SYNTHETIC DATA",
        "case": {
            "id": case.id,
            "case_number": case.case_number,
            "title": case.title,
            "case_type": case.case_type,
            "description": case.description,
            "location": case.location,
            "incident_date": case.incident_date.isoformat() if case.incident_date else None,
            "status": case.status,
            "priority": case.priority,
            "created_at": case.created_at.isoformat(),
            "updated_at": case.updated_at.isoformat(),
            "closed_at": case.closed_at.isoformat() if case.closed_at else None,
        },
        "assigned_officers": officers,
        "persons": case_persons,
        "evidence_summary": {
            "total_items": len(evidence_list),
            "items": evidence_list,
        },
        "investigation_timeline": timeline,
        "prioritization_analysis": {
            "disclaimer": (
                "Investigation Priority Score is an analytical aid only and must not be "
                "treated as proof of criminal responsibility. Final decisions must be made "
                "by authorized investigators based on verified evidence and applicable law."
            ),
            "candidates": scores,
        },
        "recent_audit_events": audit_events,
    }

    # Log report generation
    await log_action(
        db, "REPORT_GENERATED",
        user_id=current_user.id, username=current_user.username,
        resource_type="CASE", resource_id=case_id,
        details={"report_type": "FULL_CASE_REPORT"},
    )

    return report

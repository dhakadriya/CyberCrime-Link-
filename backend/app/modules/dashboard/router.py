"""Dashboard Router — Real statistics from the database"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.audit import AuditLog
from app.models.case import Case
from app.models.evidence import Evidence
from app.models.person import CasePerson, Person
from app.models.security_event import SecurityEvent
from app.models.user import User
from app.schemas.dashboard import (
    CaseStats, DashboardStats, EvidenceStats, PersonStats,
    ChartData, ChartDataPoint,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats, summary="Get dashboard statistics")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardStats:
    """
    All numbers come directly from PostgreSQL COUNT queries.
    No fake/hardcoded statistics.
    """

    async def count(model, *filters):
        q = select(func.count(model.id))
        if filters:
            q = q.where(*filters)
        return (await db.execute(q)).scalar() or 0

    # Case stats
    total_cases = await count(Case)
    open_cases = await count(Case, Case.status == "OPEN")
    under_inv = await count(Case, Case.status == "UNDER_INVESTIGATION")
    on_hold = await count(Case, Case.status == "ON_HOLD")
    solved = await count(Case, Case.status == "SOLVED")
    closed = await count(Case, Case.status == "CLOSED")
    archived = await count(Case, Case.status == "ARCHIVED")
    high_priority = await count(Case, Case.priority == "HIGH")
    critical_priority = await count(Case, Case.priority == "CRITICAL")

    # Person stats via case_persons (distinct persons)
    total_persons = await count(Person)
    suspects = (await db.execute(
        select(func.count(func.distinct(CasePerson.person_id)))
        .where(CasePerson.role == "SUSPECT", CasePerson.is_active == True)
    )).scalar() or 0
    victims = (await db.execute(
        select(func.count(func.distinct(CasePerson.person_id)))
        .where(CasePerson.role == "VICTIM", CasePerson.is_active == True)
    )).scalar() or 0
    witnesses = (await db.execute(
        select(func.count(func.distinct(CasePerson.person_id)))
        .where(CasePerson.role == "WITNESS", CasePerson.is_active == True)
    )).scalar() or 0

    # Evidence stats
    total_evidence = await count(Evidence)
    img_count = await count(Evidence, Evidence.evidence_type == "IMAGE")
    vid_count = await count(Evidence, Evidence.evidence_type == "VIDEO")
    doc_count = await count(Evidence, Evidence.evidence_type == "DOCUMENT")
    aud_count = await count(Evidence, Evidence.evidence_type == "AUDIO")
    active_evid = await count(Evidence, Evidence.status == "ACTIVE")
    archived_evid = await count(Evidence, Evidence.status == "ARCHIVED")

    # Security events in last 24h
    last_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    recent_security = (await db.execute(
        select(func.count(SecurityEvent.id)).where(SecurityEvent.created_at >= last_24h)
    )).scalar() or 0

    total_users = await count(User, User.is_active == True)

    return DashboardStats(
        cases=CaseStats(
            total=total_cases,
            open=open_cases,
            under_investigation=under_inv,
            on_hold=on_hold,
            solved=solved,
            closed=closed,
            archived=archived,
            high_priority=high_priority,
            critical_priority=critical_priority,
        ),
        persons=PersonStats(
            total=total_persons,
            suspects=suspects,
            victims=victims,
            witnesses=witnesses,
        ),
        evidence=EvidenceStats(
            total=total_evidence,
            images=img_count,
            videos=vid_count,
            documents=doc_count,
            audio=aud_count,
            active=active_evid,
            archived=archived_evid,
        ),
        recent_security_events=recent_security,
        total_users=total_users,
    )


@router.get("/charts", response_model=ChartData, summary="Get chart data for dashboard")
async def get_charts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChartData:
    """Real chart data from the database."""

    # Cases by status
    status_colors = {
        "OPEN": "#6366f1",
        "UNDER_INVESTIGATION": "#f59e0b",
        "ON_HOLD": "#94a3b8",
        "SOLVED": "#10b981",
        "CLOSED": "#64748b",
        "ARCHIVED": "#374151",
    }
    status_result = await db.execute(
        select(Case.status, func.count(Case.id)).group_by(Case.status)
    )
    cases_by_status = [
        ChartDataPoint(
            name=row[0].replace("_", " ").title(),
            value=row[1],
            color=status_colors.get(row[0], "#6366f1"),
        )
        for row in status_result.all()
    ]

    # Cases by type
    type_result = await db.execute(
        select(Case.case_type, func.count(Case.id)).group_by(Case.case_type)
    )
    cases_by_type = [
        ChartDataPoint(name=row[0].title(), value=row[1])
        for row in type_result.all()
    ]

    # Cases by priority
    priority_colors = {
        "LOW": "#10b981",
        "MEDIUM": "#f59e0b",
        "HIGH": "#f97316",
        "CRITICAL": "#ef4444",
    }
    priority_result = await db.execute(
        select(Case.priority, func.count(Case.id)).group_by(Case.priority)
    )
    cases_by_priority = [
        ChartDataPoint(
            name=row[0].title(),
            value=row[1],
            color=priority_colors.get(row[0], "#6366f1"),
        )
        for row in priority_result.all()
    ]

    # Evidence by type
    evid_type_result = await db.execute(
        select(Evidence.evidence_type, func.count(Evidence.id)).group_by(Evidence.evidence_type)
    )
    evidence_by_type = [
        ChartDataPoint(name=row[0].title(), value=row[1])
        for row in evid_type_result.all()
    ]

    # Activity last 7 days (audit log entries per day)
    activity: List[Dict[str, Any]] = []
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    for i in range(6, -1, -1):
        day_start = today - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        count_result = await db.execute(
            select(func.count(AuditLog.id)).where(
                AuditLog.created_at >= day_start,
                AuditLog.created_at < day_end,
            )
        )
        activity.append({
            "date": day_start.strftime("%b %d"),
            "events": count_result.scalar() or 0,
        })

    return ChartData(
        cases_by_status=cases_by_status,
        cases_by_type=cases_by_type,
        cases_by_priority=cases_by_priority,
        evidence_by_type=evidence_by_type,
        activity_last_7_days=activity,
    )

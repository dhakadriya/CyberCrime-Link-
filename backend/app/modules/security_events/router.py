"""Security Events Router — Security monitoring dashboard data"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_permission
from app.models.security_event import SecurityEvent
from app.models.user import User
from app.schemas.audit import SecurityEventResponse, SecurityEventListResponse

router = APIRouter(prefix="/security", tags=["Security Events"])


@router.get("/events", response_model=SecurityEventListResponse, summary="List security events")
async def list_security_events(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
    severity: Optional[str] = Query(default=None),
    event_type: Optional[str] = Query(default=None),
    resolved: Optional[bool] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("SECURITY_READ")),
) -> SecurityEventListResponse:
    query = select(SecurityEvent)

    if severity:
        query = query.where(SecurityEvent.severity == severity.upper())
    if event_type:
        query = query.where(SecurityEvent.event_type.ilike(f"%{event_type}%"))
    if resolved is not None:
        query = query.where(SecurityEvent.resolved == resolved)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    offset = (page - 1) * size
    query = query.order_by(SecurityEvent.created_at.desc()).offset(offset).limit(size)
    events = (await db.execute(query)).scalars().all()

    return SecurityEventListResponse(
        items=[_build_response(e) for e in events],
        total=total,
        page=page,
        size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.get(
    "/dashboard",
    summary="Security dashboard summary statistics",
)
async def security_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("SECURITY_READ")),
) -> dict:
    """Returns counts for the security monitoring dashboard."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import and_

    last_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    last_7d = datetime.now(timezone.utc) - timedelta(days=7)

    async def count_events(filters):
        q = select(func.count(SecurityEvent.id)).where(*filters)
        return (await db.execute(q)).scalar() or 0

    total = await count_events([])
    critical = await count_events([SecurityEvent.severity == "CRITICAL"])
    high = await count_events([SecurityEvent.severity == "HIGH"])
    unresolved = await count_events([SecurityEvent.resolved == False])
    last_24h_count = await count_events([SecurityEvent.created_at >= last_24h])
    failed_logins = await count_events([
        SecurityEvent.event_type == "FAILED_LOGIN",
        SecurityEvent.created_at >= last_7d,
    ])
    account_locks = await count_events([
        SecurityEvent.event_type == "ACCOUNT_LOCKED",
        SecurityEvent.created_at >= last_7d,
    ])
    integrity_failures = await count_events([
        SecurityEvent.event_type == "EVIDENCE_INTEGRITY_FAILED",
    ])

    # Recent critical/high events
    recent = (await db.execute(
        select(SecurityEvent)
        .where(SecurityEvent.severity.in_(["CRITICAL", "HIGH"]))
        .order_by(SecurityEvent.created_at.desc())
        .limit(10)
    )).scalars().all()

    return {
        "total_events": total,
        "critical_events": critical,
        "high_events": high,
        "unresolved_events": unresolved,
        "events_last_24h": last_24h_count,
        "failed_logins_7d": failed_logins,
        "account_lockouts_7d": account_locks,
        "evidence_integrity_failures": integrity_failures,
        "recent_critical": [_build_response(e) for e in recent],
    }


@router.put("/{event_id}/resolve", summary="Mark security event as resolved")
async def resolve_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("SECURITY_READ")),
) -> dict:
    from fastapi import HTTPException
    event = (await db.execute(
        select(SecurityEvent).where(SecurityEvent.id == event_id)
    )).scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Security event not found")
    
    event.resolved = True
    await db.commit()
    return {"message": "Event marked as resolved"}


def _build_response(e: SecurityEvent) -> SecurityEventResponse:
    return SecurityEventResponse(
        id=e.id,
        event_type=e.event_type,
        severity=e.severity,
        user_id=e.user_id,
        username=e.username,
        ip_address=e.ip_address,
        description=e.description,
        details=e.details,
        resolved=e.resolved,
        created_at=e.created_at,
    )

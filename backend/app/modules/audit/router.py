"""Audit Logs Router — Read-only, append-only access."""
import math
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_permission
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogResponse, AuditLogListResponse

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


# Respond on both /audit and /audit/ (redirect_slashes=False requires both)
@router.get("", response_model=AuditLogListResponse)
@router.get("/", response_model=AuditLogListResponse, include_in_schema=False)
async def list_audit_logs(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
    action: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    resource_type: Optional[str] = Query(default=None),
    result: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("AUDIT_READ")),
) -> AuditLogListResponse:
    query = select(AuditLog)
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type.upper())
    if result:
        query = query.where(AuditLog.result == result.upper())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    offset = (page - 1) * size
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(size)
    logs = (await db.execute(query)).scalars().all()

    return AuditLogListResponse(
        items=[_build(log) for log in logs],
        total=total, page=page, size=size,
        pages=math.ceil(total / size) if total > 0 else 0,
    )


@router.get("/{resource_type}/{resource_id}", response_model=list[AuditLogResponse])
async def get_resource_audit(
    resource_type: str,
    resource_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("AUDIT_READ")),
) -> list[AuditLogResponse]:
    result = await db.execute(
        select(AuditLog)
        .where(
            AuditLog.resource_type == resource_type.upper(),
            AuditLog.resource_id == resource_id,
        )
        .order_by(AuditLog.created_at.desc())
        .limit(200)
    )
    return [_build(log) for log in result.scalars().all()]


def _build(log: AuditLog) -> AuditLogResponse:
    return AuditLogResponse(
        id=log.id, user_id=log.user_id, username=log.username,
        action=log.action, resource_type=log.resource_type,
        resource_id=log.resource_id, result=log.result,
        ip_address=log.ip_address, user_agent=log.user_agent,
        details=log.details, created_at=log.created_at,
    )

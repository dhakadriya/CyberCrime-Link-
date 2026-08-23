"""
Audit Service
──────────────
Central service for creating audit log entries and security events.

This is called from routers, services, and middleware to record
every sensitive action. It NEVER raises exceptions — audit failure
must not break the main operation.

IMPORTANT: Never log passwords, tokens, or secrets in details.
"""

from typing import Any, Dict, Optional
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog
from app.models.security_event import SecurityEvent
from app.core.logging import audit_logger, security_logger


def _get_client_ip(request: Optional[Request]) -> Optional[str]:
    """Extract real client IP, respecting X-Forwarded-For in production."""
    if not request:
        return None
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _get_user_agent(request: Optional[Request]) -> Optional[str]:
    if not request:
        return None
    return request.headers.get("User-Agent", "")[:500]  # Truncate long UAs


async def log_action(
    db: AsyncSession,
    action: str,
    result: str = "SUCCESS",
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Create an audit log entry.
    
    Called like:
        await log_action(
            db, "CASE_CREATED",
            user_id=user.id,
            username=user.username,
            resource_type="CASE",
            resource_id=case.id,
            details={"case_number": case.case_number},
            request=request
        )
    """
    try:
        entry = AuditLog(
            user_id=user_id,
            username=username,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            result=result,
            ip_address=_get_client_ip(request),
            user_agent=_get_user_agent(request),
            details=details,
        )
        db.add(entry)
        # Note: we don't commit here — the route's session commit handles it
        # This keeps audit log + the main action in the same transaction

        audit_logger.info(
            "audit_event",
            action=action,
            user_id=user_id,
            username=username,
            result=result,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
        )
    except Exception as e:
        # Audit failure must NOT break main operation
        audit_logger.error("audit_log_failed", error=str(e), action=action)


async def log_security_event(
    db: AsyncSession,
    event_type: str,
    description: str,
    severity: str = "MEDIUM",
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Create a security event entry.
    
    Severity levels:
    - LOW: informational
    - MEDIUM: suspicious but not critical
    - HIGH: potential attack
    - CRITICAL: active attack / data integrity issue
    """
    try:
        event = SecurityEvent(
            event_type=event_type,
            severity=severity,
            user_id=user_id,
            username=username,
            ip_address=_get_client_ip(request),
            user_agent=_get_user_agent(request),
            description=description,
            details=details,
        )
        db.add(event)

        security_logger.warning(
            "security_event",
            event_type=event_type,
            severity=severity,
            user_id=user_id,
            username=username,
            description=description,
        )
    except Exception as e:
        security_logger.error("security_event_failed", error=str(e), event_type=event_type)

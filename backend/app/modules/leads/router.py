"""
Investigative Leads Router
──────────────────────────
Manages auto-generated and manual investigative leads.
Every lead is explainable and linked to source data.

IMPORTANT: Leads are analytical aids — NOT guilt determinations.
"""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_permission, get_current_user
from app.models.lead import InvestigativeLead
from app.models.user import User
from app.services.audit_service import log_action

router = APIRouter(prefix="/leads", tags=["Investigative Leads"])

DISCLAIMER = (
    "Investigative leads are analytical aids derived from data patterns. "
    "They do not constitute evidence of criminal activity. "
    "All leads require human investigator review and verification."
)


class LeadCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=500)
    lead_type: str = Field(default="MANUAL")
    description: str = Field(..., min_length=10)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    severity: str = Field(default="MEDIUM")
    subject_type: Optional[str] = None
    subject_id: Optional[str] = None
    subject_name: Optional[str] = None
    case_id: Optional[str] = None
    supporting_data: Optional[dict] = None
    notes: Optional[str] = None


class LeadUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[str] = None


@router.get("")
async def list_leads(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    lead_type: Optional[str] = Query(default=None),
    severity: Optional[str] = Query(default=None),
    case_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
):
    """List all investigative leads with filtering."""
    q = select(InvestigativeLead)
    if status_filter:
        q = q.where(InvestigativeLead.status == status_filter)
    if lead_type:
        q = q.where(InvestigativeLead.lead_type == lead_type)
    if severity:
        q = q.where(InvestigativeLead.severity == severity)
    if case_id:
        q = q.where(InvestigativeLead.case_id == case_id)

    total = (await db.execute(
        select(func.count()).select_from(q.subquery())
    )).scalar() or 0

    q = q.order_by(InvestigativeLead.created_at.desc())
    q = q.offset((page - 1) * size).limit(size)
    leads = (await db.execute(q)).scalars().all()

    return {
        "items": [_format_lead(l) for l in leads],
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, (total + size - 1) // size),
        "disclaimer": DISCLAIMER,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_CREATE")),
):
    """Create a manual investigative lead."""
    lead = InvestigativeLead(
        title=payload.title,
        lead_type=payload.lead_type,
        description=payload.description,
        confidence=payload.confidence,
        severity=payload.severity,
        subject_type=payload.subject_type,
        subject_id=payload.subject_id,
        subject_name=payload.subject_name,
        case_id=payload.case_id,
        supporting_data=json.dumps(payload.supporting_data) if payload.supporting_data else None,
        notes=payload.notes,
        status="OPEN",
        auto_generated=False,
        source_module="manual",
        created_by=current_user.id,
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)

    await log_action(
        db, "LEAD_CREATED",
        user_id=current_user.id, username=current_user.username,
        resource_type="LEAD", resource_id=lead.id,
        details={"title": lead.title, "lead_type": lead.lead_type},
    )
    return _format_lead(lead)


@router.get("/stats")
async def get_lead_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
):
    """Summary statistics for investigative leads dashboard."""
    async def count(filters):
        return (await db.execute(
            select(func.count(InvestigativeLead.id)).where(*filters)
        )).scalar() or 0

    total = await count([])
    open_leads = await count([InvestigativeLead.status == "OPEN"])
    reviewed = await count([InvestigativeLead.status == "REVIEWED"])
    critical = await count([InvestigativeLead.severity == "CRITICAL"])
    high = await count([InvestigativeLead.severity == "HIGH"])
    auto = await count([InvestigativeLead.auto_generated == True])

    # By type
    type_result = await db.execute(
        select(InvestigativeLead.lead_type, func.count(InvestigativeLead.id))
        .group_by(InvestigativeLead.lead_type)
    )
    by_type = [{"type": r[0], "count": r[1]} for r in type_result.all()]

    return {
        "total": total,
        "open": open_leads,
        "reviewed": reviewed,
        "critical": critical,
        "high": high,
        "auto_generated": auto,
        "by_type": by_type,
    }


@router.get("/{lead_id}")
async def get_lead(
    lead_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
):
    lead = await _get_or_404(db, lead_id)
    return _format_lead(lead)


@router.patch("/{lead_id}")
async def update_lead(
    lead_id: str,
    payload: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_UPDATE")),
):
    """Update lead status, notes, or assignment."""
    lead = await _get_or_404(db, lead_id)

    if payload.status is not None:
        valid_statuses = {"OPEN", "REVIEWED", "ASSIGNED", "DISMISSED", "ACTIONED"}
        if payload.status not in valid_statuses:
            raise HTTPException(400, f"Invalid status. Must be one of: {valid_statuses}")
        lead.status = payload.status
    if payload.notes is not None:
        lead.notes = payload.notes
    if payload.assigned_to is not None:
        lead.assigned_to = payload.assigned_to

    lead.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(lead)

    await log_action(
        db, "LEAD_UPDATED",
        user_id=current_user.id, username=current_user.username,
        resource_type="LEAD", resource_id=lead.id,
        details={"status": lead.status},
    )
    return _format_lead(lead)


@router.post("/generate-from-network")
async def generate_leads_from_network(
    case_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_CREATE")),
):
    """
    Auto-generate investigative leads from network analysis results.
    Runs network analysis and creates leads for anomalies/bridges.
    """
    from app.modules.network_analysis.engine import compute_network_stats

    result = await compute_network_stats(db, case_id=case_id)
    leads_created = []

    # Generate leads from anomalies
    for anomaly in result.get("anomalies", []):
        title = f"Network Anomaly: {anomaly['label']}"
        existing = (await db.execute(
            select(InvestigativeLead).where(
                InvestigativeLead.subject_id == anomaly["node_id"],
                InvestigativeLead.lead_type == anomaly["type"],
                InvestigativeLead.status == "OPEN",
            )
        )).scalar_one_or_none()

        if not existing:
            supporting = {
                "anomaly_type": anomaly["type"],
                "severity": anomaly["severity"],
                "explanation": anomaly["description"],
                "confidence": anomaly["confidence"],
                "network_nodes": result["nodes"],
                "network_edges": result["edges"],
            }
            lead = InvestigativeLead(
                title=title,
                lead_type=anomaly["type"],
                description=anomaly["description"],
                confidence=anomaly["confidence"],
                severity=anomaly["severity"],
                subject_type="PERSON",
                subject_id=anomaly["node_id"],
                subject_name=anomaly["label"],
                case_id=case_id,
                supporting_data=json.dumps(supporting),
                status="OPEN",
                auto_generated=True,
                source_module="network_analysis",
                created_by=current_user.id,
            )
            db.add(lead)
            await db.flush()
            leads_created.append(_format_lead(lead))

    # Generate leads from top influencers
    for inf in result.get("influencers", [])[:3]:
        if inf["influence_score"] > 50:
            existing = (await db.execute(
                select(InvestigativeLead).where(
                    InvestigativeLead.subject_id == inf["node_id"],
                    InvestigativeLead.lead_type == "HIGH_DEGREE_NODE",
                    InvestigativeLead.status == "OPEN",
                )
            )).scalar_one_or_none()

            if not existing:
                supporting = {
                    "influence_score": inf["influence_score"],
                    "degree_centrality": inf["degree_centrality"],
                    "betweenness_centrality": inf["betweenness_centrality"],
                    "pagerank": inf["pagerank"],
                    "degree": inf["degree"],
                    "communities": inf["communities"],
                }
                desc = (
                    f"{inf['label']} shows high network influence (score: {inf['influence_score']:.1f}/100). "
                    f"Connected to {inf['degree']} entities with betweenness centrality of "
                    f"{inf['betweenness_centrality']:.3f}. Warrants investigative attention."
                )
                lead = InvestigativeLead(
                    title=f"Network Influencer: {inf['label']}",
                    lead_type="HIGH_DEGREE_NODE",
                    description=desc,
                    confidence=min(0.9, inf["influence_score"] / 100),
                    severity="HIGH" if inf["influence_score"] > 70 else "MEDIUM",
                    subject_type="PERSON",
                    subject_id=inf["node_id"],
                    subject_name=inf["label"],
                    case_id=case_id,
                    supporting_data=json.dumps(supporting),
                    status="OPEN",
                    auto_generated=True,
                    source_module="network_analysis",
                    created_by=current_user.id,
                )
                db.add(lead)
                await db.flush()
                leads_created.append(_format_lead(lead))

    await db.commit()

    await log_action(
        db, "LEADS_GENERATED",
        user_id=current_user.id, username=current_user.username,
        resource_type="LEAD",
        details={"leads_created": len(leads_created), "source": "network_analysis"},
    )

    return {
        "leads_created": len(leads_created),
        "leads": leads_created,
        "disclaimer": DISCLAIMER,
    }


async def _get_or_404(db: AsyncSession, lead_id: str) -> InvestigativeLead:
    lead = (await db.execute(
        select(InvestigativeLead).where(InvestigativeLead.id == lead_id)
    )).scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


def _format_lead(lead: InvestigativeLead) -> dict:
    supporting = None
    if lead.supporting_data:
        try:
            supporting = json.loads(lead.supporting_data)
        except Exception:
            supporting = {"raw": lead.supporting_data}
    return {
        "id": lead.id,
        "title": lead.title,
        "lead_type": lead.lead_type,
        "description": lead.description,
        "confidence": lead.confidence,
        "severity": lead.severity,
        "subject_type": lead.subject_type,
        "subject_id": lead.subject_id,
        "subject_name": lead.subject_name,
        "case_id": lead.case_id,
        "supporting_data": supporting,
        "status": lead.status,
        "assigned_to": lead.assigned_to,
        "notes": lead.notes,
        "auto_generated": lead.auto_generated,
        "source_module": lead.source_module,
        "created_by": lead.created_by,
        "created_at": lead.created_at.isoformat(),
        "updated_at": lead.updated_at.isoformat(),
    }

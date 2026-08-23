"""
Suspect Prioritization Router
──────────────────────────────
Exposes the rule-based investigation priority scoring engine.

IMPORTANT DISCLAIMER displayed on every response:
"Investigation Priority Score is an analytical aid only and must not be
treated as proof of criminal responsibility."
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_permission
from app.models.case import Case
from app.models.scoring import SuspectScore
from app.models.user import User
from app.schemas.scoring import PrioritizationResult, SuspectScoreResponse, ScoreBreakdown
from app.services.audit_service import log_action
from app.modules.prioritization.engine import PrioritizationEngine

router = APIRouter(tags=["Suspect Prioritization"])


@router.post(
    "/cases/{case_id}/prioritize",
    response_model=PrioritizationResult,
    summary="Run suspect prioritization for a case",
)
async def run_prioritization(
    request: Request,
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
) -> PrioritizationResult:
    """
    Runs the rule-based prioritization engine on all suspects in a case.
    Scores are deterministic and explainable.
    """
    case = (await db.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    engine = PrioritizationEngine(db)
    scores = await engine.score_case(case_id, current_user.id)

    await log_action(
        db, "PRIORITIZATION_RUN",
        user_id=current_user.id, username=current_user.username,
        resource_type="CASE", resource_id=case_id,
        details={"candidates": len(scores)},
        request=request,
    )

    return PrioritizationResult(
        case_id=case_id,
        case_number=case.case_number,
        candidates=scores,
        total_candidates=len(scores),
        generated_at=datetime.now(timezone.utc),
        engine_version="1.0.0-rules",
    )


@router.get(
    "/cases/{case_id}/scores",
    response_model=PrioritizationResult,
    summary="Get latest prioritization scores for a case",
)
async def get_scores(
    case_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("CASE_READ")),
) -> PrioritizationResult:
    case = (await db.execute(select(Case).where(Case.id == case_id))).scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    result = await db.execute(
        select(SuspectScore)
        .where(
            SuspectScore.case_id == case_id,
            SuspectScore.is_latest == True,
        )
        .order_by(SuspectScore.score.desc())
    )
    score_records = result.scalars().all()

    candidates = []
    for s in score_records:
        from app.models.person import Person
        person = (await db.execute(select(Person).where(Person.id == s.person_id))).scalar_one_or_none()
        candidates.append(SuspectScoreResponse(
            id=s.id,
            case_id=s.case_id,
            person_id=s.person_id,
            person_name=person.full_name if person else "Unknown",
            score=float(s.score),
            score_breakdown=ScoreBreakdown(**s.score_breakdown),
            contributing_factors=s.contributing_factors,
            data_sources=s.data_sources,
            engine_version=s.engine_version,
            generated_at=s.generated_at,
            is_latest=s.is_latest,
        ))

    return PrioritizationResult(
        case_id=case_id,
        case_number=case.case_number,
        candidates=candidates,
        total_candidates=len(candidates),
        generated_at=datetime.now(timezone.utc),
        engine_version="1.0.0-rules",
    )

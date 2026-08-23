"""Network Analysis Router — real graph intelligence via NetworkX."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.middleware.auth import require_permission
from app.modules.network_analysis.engine import (
    compute_network_stats, shortest_path, k_hop_neighbors,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/network", tags=["Network Analysis"])

DISCLAIMER = (
    "Network analysis scores are investigative aids only. "
    "High centrality does not establish criminal responsibility. "
    "All findings require human investigator review."
)


@router.get("")
@router.get("/", include_in_schema=False)
async def get_network_overview(
    case_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("CASE_READ")),
):
    """Full network analysis: centrality, communities, influencers, anomalies."""
    result = await compute_network_stats(db, case_id=case_id)
    result["disclaimer"] = DISCLAIMER
    return result


@router.get("/influencers")
async def get_influencers(
    case_id: Optional[str] = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("CASE_READ")),
):
    """Top network influencers by composite centrality score."""
    result = await compute_network_stats(db, case_id=case_id)
    return {
        "influencers": result["influencers"][:limit],
        "total_nodes": result["nodes"],
        "disclaimer": DISCLAIMER,
    }


@router.get("/communities")
async def get_communities(
    case_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("CASE_READ")),
):
    """Detected network communities."""
    result = await compute_network_stats(db, case_id=case_id)
    return {
        "communities": result["communities"],
        "total_communities": len(result["communities"]),
        "disclaimer": DISCLAIMER,
    }


@router.get("/anomalies")
async def get_anomalies(
    case_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("CASE_READ")),
):
    """Detected network anomalies and suspicious patterns."""
    result = await compute_network_stats(db, case_id=case_id)
    return {
        "anomalies": result["anomalies"],
        "disclaimer": DISCLAIMER,
    }


@router.get("/shortest-path")
async def get_shortest_path(
    source_id: str = Query(...),
    target_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("CASE_READ")),
):
    """Shortest path between two entities in the network."""
    return await shortest_path(db, source_id, target_id)


@router.get("/neighbors/{node_id}")
async def get_neighbors(
    node_id: str,
    k: int = Query(default=2, ge=1, le=4),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("CASE_READ")),
):
    """K-hop neighborhood of a node."""
    return await k_hop_neighbors(db, node_id, k)

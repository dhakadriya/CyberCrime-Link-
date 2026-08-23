"""
Network Analysis Engine — NetworkX-powered graph intelligence.

Computes on the Relationship table from SQLite, builds a NetworkX
DiGraph, and returns centrality measures, communities, anomalies,
and shortest paths.

All scores are ANALYTICAL only — not determinations of guilt.
"""
from __future__ import annotations
import math
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.relationship import Relationship
from app.models.person import Person, CasePerson
from app.models.case import Case


async def _build_graph(db: AsyncSession, case_id: Optional[str] = None) -> nx.DiGraph:
    """Build a directed NetworkX graph from the Relationship table."""
    G = nx.DiGraph()

    # Load all persons as nodes
    persons_result = await db.execute(select(Person))
    for p in persons_result.scalars().all():
        G.add_node(
            p.id,
            label=p.full_name,
            node_type="PERSON",
            alias=p.alias or "",
        )

    # Load relationships as edges
    q = select(Relationship)
    if case_id:
        q = q.where(Relationship.case_id == case_id)
    rels_result = await db.execute(q)
    strength_map = {"WEAK": 1, "MEDIUM": 2, "STRONG": 3}
    for rel in rels_result.scalars().all():
        weight = strength_map.get(rel.strength, 1)
        if not G.has_node(rel.source_id):
            G.add_node(rel.source_id, label=rel.source_id[:8], node_type=rel.source_type)
        if not G.has_node(rel.target_id):
            G.add_node(rel.target_id, label=rel.target_id[:8], node_type=rel.target_type)
        G.add_edge(
            rel.source_id, rel.target_id,
            rel_type=rel.relationship_type,
            weight=weight,
            strength=rel.strength,
            rel_id=rel.id,
        )
    return G


def _safe_centrality(values: dict, top_n: int = 20) -> List[Dict]:
    """Return top-N nodes sorted by centrality value."""
    return sorted(
        [{"node_id": k, "score": round(v, 4)} for k, v in values.items()],
        key=lambda x: x["score"],
        reverse=True
    )[:top_n]


async def compute_network_stats(
    db: AsyncSession,
    case_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Full network analysis:
    - Degree, betweenness, PageRank centrality
    - Community detection (greedy modularity on undirected projection)
    - Anomaly detection (sudden high-degree nodes, bridge detection)
    - Summary statistics
    """
    G = await _build_graph(db, case_id)

    if G.number_of_nodes() == 0:
        return {
            "nodes": 0, "edges": 0,
            "centrality": [], "communities": [], "anomalies": [],
            "influencers": [], "components": 0,
        }

    U = G.to_undirected()  # undirected for some algorithms

    # ── Centrality ──────────────────────────────────────────────────────────
    degree_c = nx.degree_centrality(G)
    try:
        between_c = nx.betweenness_centrality(G, normalized=True)
    except Exception:
        between_c = {n: 0.0 for n in G.nodes()}
    try:
        pagerank = nx.pagerank(G, alpha=0.85, max_iter=100)
    except Exception:
        pagerank = {n: 0.0 for n in G.nodes()}

    # ── Community detection (Louvain-like via greedy modularity) ─────────────
    communities: List[Dict] = []
    try:
        community_sets = list(nx.community.greedy_modularity_communities(U))
        for i, comm in enumerate(community_sets):
            communities.append({
                "id": i + 1,
                "members": list(comm),
                "size": len(comm),
                "internal_edges": U.subgraph(comm).number_of_edges(),
            })
    except Exception:
        pass

    # ── Influencers ──────────────────────────────────────────────────────────
    # Composite influence score = 0.4*degree + 0.4*betweenness + 0.2*pagerank
    influencers = []
    for node in G.nodes():
        score = (
            0.4 * degree_c.get(node, 0) +
            0.4 * between_c.get(node, 0) +
            0.2 * pagerank.get(node, 0)
        )
        # Find which communities this node belongs to
        member_communities = [
            c["id"] for c in communities if node in c["members"]
        ]
        bridges_communities = len(member_communities) > 1
        influencers.append({
            "node_id": node,
            "label": G.nodes[node].get("label", node[:8]),
            "node_type": G.nodes[node].get("node_type", "UNKNOWN"),
            "influence_score": round(score * 100, 1),
            "degree_centrality": round(degree_c.get(node, 0), 4),
            "betweenness_centrality": round(between_c.get(node, 0), 4),
            "pagerank": round(pagerank.get(node, 0), 4),
            "degree": G.degree(node),
            "in_degree": G.in_degree(node),
            "out_degree": G.out_degree(node),
            "is_bridge_node": bridges_communities,
            "communities": member_communities,
        })
    influencers.sort(key=lambda x: x["influence_score"], reverse=True)

    # ── Anomaly detection ─────────────────────────────────────────────────────
    anomalies = []
    # 1. Bridge nodes (articulation points) — removing them disconnects the graph
    try:
        art_points = list(nx.articulation_points(U))
        for ap in art_points[:5]:
            anomalies.append({
                "type": "BRIDGE_NODE",
                "node_id": ap,
                "label": G.nodes[ap].get("label", ap[:8]),
                "severity": "MEDIUM",
                "description": (
                    f"{G.nodes[ap].get('label', 'This node')} is a critical bridge. "
                    "Removing it would disconnect parts of the network. "
                    "Warrants investigative attention."
                ),
                "confidence": 0.9,
            })
    except Exception:
        pass

    # 2. Hub anomaly — nodes with significantly above-average degree
    if G.number_of_nodes() > 3:
        degrees = [d for _, d in G.degree()]
        avg_deg = sum(degrees) / len(degrees)
        std_deg = (sum((d - avg_deg) ** 2 for d in degrees) / len(degrees)) ** 0.5
        threshold = avg_deg + 2 * std_deg
        for node, deg in G.degree():
            if deg > threshold and deg > 3:
                anomalies.append({
                    "type": "HIGH_DEGREE_NODE",
                    "node_id": node,
                    "label": G.nodes[node].get("label", node[:8]),
                    "severity": "HIGH" if deg > threshold * 1.5 else "MEDIUM",
                    "description": (
                        f"{G.nodes[node].get('label', 'Node')} has {deg} connections "
                        f"(network average: {avg_deg:.1f}). "
                        "Unusually high connectivity — potential investigative lead."
                    ),
                    "confidence": min(0.95, 0.6 + (deg - threshold) / (threshold + 1) * 0.3),
                })

    # 3. Isolated community bridges
    if len(communities) >= 2:
        for node_info in influencers[:10]:
            if node_info["is_bridge_node"] and len(node_info["communities"]) >= 2:
                already = any(a["node_id"] == node_info["node_id"] for a in anomalies)
                if not already:
                    anomalies.append({
                        "type": "COMMUNITY_BRIDGE",
                        "node_id": node_info["node_id"],
                        "label": node_info["label"],
                        "severity": "HIGH",
                        "description": (
                            f"{node_info['label']} connects {len(node_info['communities'])} "
                            "distinct network communities. This person may serve as a "
                            "conduit between separate criminal networks."
                        ),
                        "confidence": 0.8,
                    })

    # ── Connected components ──────────────────────────────────────────────────
    components = nx.number_weakly_connected_components(G)

    return {
        "nodes": G.number_of_nodes(),
        "edges": G.number_of_edges(),
        "components": components,
        "density": round(nx.density(G), 4),
        "influencers": influencers[:20],
        "communities": communities,
        "anomalies": anomalies[:10],
        "centrality": {
            "degree": _safe_centrality(degree_c),
            "betweenness": _safe_centrality(between_c),
            "pagerank": _safe_centrality(pagerank),
        },
    }


async def shortest_path(
    db: AsyncSession,
    source_id: str,
    target_id: str,
) -> Dict[str, Any]:
    """Find shortest path between two nodes."""
    G = await _build_graph(db)
    try:
        path = nx.shortest_path(G, source=source_id, target=target_id)
        path_details = []
        for i, node in enumerate(path):
            node_data = G.nodes.get(node, {})
            path_details.append({
                "node_id": node,
                "label": node_data.get("label", node[:8]),
                "node_type": node_data.get("node_type", "UNKNOWN"),
                "step": i + 1,
            })
        edges_on_path = []
        for i in range(len(path) - 1):
            edge_data = G.edges.get((path[i], path[i + 1]), {})
            edges_on_path.append({
                "from": path[i],
                "to": path[i + 1],
                "rel_type": edge_data.get("rel_type", "UNKNOWN"),
                "strength": edge_data.get("strength", "UNKNOWN"),
            })
        return {
            "found": True,
            "length": len(path) - 1,
            "path": path_details,
            "edges": edges_on_path,
        }
    except nx.NetworkXNoPath:
        return {"found": False, "message": "No path exists between these entities."}
    except nx.NodeNotFound as e:
        return {"found": False, "message": f"Entity not found: {e}"}


async def k_hop_neighbors(
    db: AsyncSession,
    node_id: str,
    k: int = 2,
) -> Dict[str, Any]:
    """Return all nodes within k hops of a given node."""
    G = await _build_graph(db)
    if node_id not in G:
        return {"found": False, "neighbors": []}

    neighbors_by_hop: Dict[int, List] = {}
    visited = {node_id}
    current_level = {node_id}

    for hop in range(1, k + 1):
        next_level = set()
        for node in current_level:
            for neighbor in G.successors(node):
                if neighbor not in visited:
                    next_level.add(neighbor)
                    visited.add(neighbor)
            for neighbor in G.predecessors(node):
                if neighbor not in visited:
                    next_level.add(neighbor)
                    visited.add(neighbor)
        neighbors_by_hop[hop] = [
            {
                "node_id": n,
                "label": G.nodes[n].get("label", n[:8]),
                "node_type": G.nodes[n].get("node_type", "UNKNOWN"),
            }
            for n in next_level
        ]
        current_level = next_level

    return {
        "found": True,
        "source": node_id,
        "source_label": G.nodes.get(node_id, {}).get("label", node_id[:8]),
        "k": k,
        "total_neighbors": len(visited) - 1,
        "neighbors_by_hop": neighbors_by_hop,
    }

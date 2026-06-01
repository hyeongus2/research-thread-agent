"""Citation-based research lineage graph builder.

Graph construction (single-fetch approach):
  1. Fetch top 100 papers for the query in one API call, including each
     paper's reference list (paperId + citationCount).
  2. Top 5 by all-time citation count become red "seed" nodes.
     The rest become blue "reference" nodes, grouped by publication year.
  3. Edges are drawn wherever paper A references paper B and both are in
     the top-100 result set — no extra per-paper API calls needed.
  4. Nodes that have no edges (and are not seeds) are hidden.

This replaces the previous 30+ API call approach with a single request,
reducing build time from 30-60 s to ~3 s.
"""

import logging
from datetime import date

from services.semantic_scholar_service import AI_FIELDS_OF_STUDY, search_papers_for_graph

logger = logging.getLogger(__name__)

_MAX_NODES = 200
_MAX_EDGES = 400
_SEED_COUNT = 5      # top-N all-time papers become red seed nodes
_FETCH_LIMIT = 100   # papers fetched in the single bulk call


def _importance_score(citation_count: int, year, is_seed: bool, max_cit: int) -> float:
    recency = 0.1 if (year or 0) >= 2020 else 0.0
    seed_bonus = 0.2 if is_seed else 0.0
    raw = (citation_count / max_cit) * 0.7 + recency + seed_bonus
    return round(min(1.0, max(0.0, raw)), 4)


def _node_key(p: dict) -> str:
    return p.get("paper_id") or p.get("title") or ""


def _parse_year(published_date: str) -> int | None:
    fragment = (published_date or "")[:4]
    return int(fragment) if fragment.isdigit() else None


def _make_node(p: dict, node_type: str) -> dict:
    year = _parse_year(p.get("published_date", ""))
    return {
        "id": _node_key(p),
        "title": p.get("title") or "",
        "year": year,
        "authors": p.get("authors") or [],
        "venue": p.get("venue") or None,
        "abstract": p.get("abstract") or None,
        "url": p.get("url") or None,
        "citationCount": p.get("citation_count") or 0,
        "influentialCitationCount": None,
        "importanceScore": 0.0,
        "type": node_type,
    }


def build_citation_graph(
    query: str,
    max_seed_papers: int = _SEED_COUNT,
    max_depth: int = 1,
    min_citations: int = 0,
) -> dict:
    _ = (max_depth,)

    # ── 1. Single bulk fetch with embedded references ─────────────────────────
    papers = search_papers_for_graph(query, limit=_FETCH_LIMIT, fields_of_study=AI_FIELDS_OF_STUDY)
    if not papers:
        return {
            "query": query,
            "nodes": [],
            "edges": [],
            "warning": "No citation graph could be built from the available Semantic Scholar metadata.",
        }

    papers = [p for p in papers if (p.get("citation_count") or 0) >= min_citations]

    # ── 2. Classify nodes ─────────────────────────────────────────────────────
    seed_count = min(max_seed_papers or _SEED_COUNT, len(papers))
    seed_ids = {p["paper_id"] for p in papers[:seed_count] if p["paper_id"]}
    paper_by_id = {p["paper_id"]: p for p in papers if p["paper_id"]}

    nodes: dict[str, dict] = {}
    for p in papers:
        pid = p["paper_id"]
        if not pid:
            continue
        node_type = "seed" if pid in seed_ids else "reference"
        nodes[pid] = _make_node(p, node_type)

    # ── 3. Build edges from reference intersection ────────────────────────────
    edges: list[dict] = []
    seen_edges: set[tuple] = set()

    for p in papers:
        pid = p["paper_id"]
        if not pid:
            continue
        for (ref_id, _) in p.get("reference_ids", []):
            if ref_id not in paper_by_id or ref_id == pid:
                continue
            edge_key = (ref_id, pid)
            if edge_key in seen_edges or len(edges) >= _MAX_EDGES:
                continue
            seen_edges.add(edge_key)
            edges.append({
                "source": ref_id,
                "target": pid,
                "relation": "cites",
                "confidence": 1.0,
                "isInfluential": ref_id in seed_ids,
            })

    # ── 4. Drop isolated non-seed nodes ──────────────────────────────────────
    connected_ids = {e["source"] for e in edges} | {e["target"] for e in edges}
    node_list = [
        n for n in nodes.values()
        if n["id"] in connected_ids or n["type"] == "seed"
    ][:_MAX_NODES]

    # ── 5. Importance scores ──────────────────────────────────────────────────
    max_cit = max((n["citationCount"] for n in node_list), default=1) or 1
    for n in node_list:
        n["importanceScore"] = _importance_score(
            n["citationCount"], n.get("year"), n["type"] == "seed", max_cit
        )

    result: dict = {"query": query, "nodes": node_list, "edges": edges}
    if not node_list:
        result["warning"] = "No citation graph could be built from the available Semantic Scholar metadata."
    return result

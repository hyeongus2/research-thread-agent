"""Citation-based research lineage graph builder.

MVP: depth=1 reference expansion only. Deeper traversal intentionally deferred.
Citation relationships are metadata-based approximations and do not guarantee
direct intellectual inheritance.
"""

import logging

from services.semantic_scholar_service import get_paper_references, search_papers

logger = logging.getLogger(__name__)

_MAX_NODES = 50
_MAX_EDGES = 100
_REF_SEEDS_CAP = 5   # limit references API calls to top N seeds
_REFS_PER_SEED = 30


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


def build_citation_graph(
    query: str,
    max_seed_papers: int = 20,
    max_depth: int = 1,
    min_citations: int = 0,
) -> dict:
    # max_depth > 1 is accepted for future compatibility but treated as 1 in this MVP.
    # Recursive reference traversal is intentionally deferred.
    _ = max_depth

    # 1. Search seed papers
    seed_raw = search_papers(query, limit=max_seed_papers)

    if not seed_raw:
        return {
            "query": query,
            "nodes": [],
            "edges": [],
            "warning": "No citation graph could be built from the available Semantic Scholar metadata.",
        }

    # 2. Build initial node map — paper_id preferred key, title as fallback
    nodes: dict[str, dict] = {}
    for p in seed_raw:
        key = _node_key(p)
        if not key:
            continue
        nodes[key] = {
            "id": key,
            "title": p["title"],
            "year": _parse_year(p.get("published_date", "")),
            "authors": p.get("authors") or [],
            "venue": p.get("venue") or None,
            "abstract": p.get("abstract") or None,
            "url": p.get("url") or None,
            "citationCount": p.get("citation_count") or 0,
            "influentialCitationCount": None,
            "importanceScore": 0.0,
            "type": "seed",
        }

    # 3. Expand references for top seeds that have a Semantic Scholar paper_id
    seeds_with_id = [p for p in seed_raw if p.get("paper_id")]
    top_seeds = sorted(seeds_with_id, key=lambda p: p.get("citation_count", 0), reverse=True)[:_REF_SEEDS_CAP]

    edges: list[dict] = []

    for seed in top_seeds:
        if len(nodes) >= _MAX_NODES:
            break

        seed_key = seed["paper_id"]
        refs = get_paper_references(seed_key, limit=_REFS_PER_SEED)

        for ref in refs:
            if (ref.get("citation_count") or 0) < min_citations:
                continue
            ref_key = _node_key(ref)
            if not ref_key:
                continue

            # Add reference node only if not already present.
            # Never overwrite a seed node with type="reference" (seed > reference).
            if ref_key not in nodes:
                nodes[ref_key] = {
                    "id": ref_key,
                    "title": ref["title"],
                    "year": _parse_year(ref.get("published_date", "")),
                    "authors": ref.get("authors") or [],
                    "venue": ref.get("venue") or None,
                    "abstract": ref.get("abstract") or None,
                    "url": ref.get("url") or None,
                    "citationCount": ref.get("citation_count") or 0,
                    "influentialCitationCount": None,
                    "importanceScore": 0.0,
                    "type": "reference",
                }

            # Edge direction: seed cites ref → source=ref (older), target=seed (newer)
            if len(edges) < _MAX_EDGES:
                edges.append({
                    "source": ref_key,
                    "target": seed_key,
                    "relation": "cites",
                    "confidence": 1.0,
                    "isInfluential": ref.get("is_influential", False),
                })

    # 4. Cap nodes
    node_list = list(nodes.values())[:_MAX_NODES]
    valid_ids = {n["id"] for n in node_list}

    # 5. Compute importance scores
    max_cit = max((n["citationCount"] for n in node_list), default=1) or 1
    for n in node_list:
        n["importanceScore"] = _importance_score(
            n["citationCount"], n.get("year"), n["type"] == "seed", max_cit
        )

    # 6. Filter edges to valid nodes and apply cap
    edge_list = [
        e for e in edges
        if e["source"] in valid_ids and e["target"] in valid_ids
    ][:_MAX_EDGES]

    result: dict = {"query": query, "nodes": node_list, "edges": edge_list}
    if not node_list:
        result["warning"] = "No citation graph could be built from the available Semantic Scholar metadata."
    return result

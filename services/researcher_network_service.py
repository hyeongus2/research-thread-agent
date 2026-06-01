"""Coauthorship network builder (Researcher Network).

Given a root PI/author name, builds a dynamic coauthorship network from
Semantic Scholar author/paper metadata:
  - node = researcher, edge = coauthorship relationship
  - edge weight = number of shared papers

IMPORTANT: The primary relationship is coauthorship — a FACT derived from
shared publications. This is NOT academic genealogy. Edges never claim
advisor-student relationships. Optional `relationshipHints` (e.g.
"possible_mentor_trainee_pattern") are heuristic hints only, surfaced solely
when multiple metadata signals coincide, and every edge carries an explicit
warning.

The existing semantic_scholar_service.get_author_papers() collapses each
paper's author list to the first 5 names and drops authorId / author position,
so it cannot be reused here. We fetch papers ourselves (reusing the shared
_ss_lock rate-limit gate) to preserve authorId and ordering.
"""

import logging
import time

import requests

from config.settings import settings
from services.semantic_scholar_service import _ss_lock

logger = logging.getLogger(__name__)

_SS_AUTHOR_SEARCH_URL = "https://api.semanticscholar.org/graph/v1/author/search"
_SS_AUTHOR_PAPERS_URL = "https://api.semanticscholar.org/graph/v1/author/{author_id}/papers"
_SS_AUTHOR_FIELDS = "authorId,name,affiliations,paperCount,citationCount,hIndex"
# authors.affiliations is not supported by the author-papers endpoint, so
# per-paper affiliation matching is unavailable in this MVP.
_SS_PAPER_FIELDS = (
    "paperId,title,year,citationCount,"
    "authors.authorId,authors.name,publicationVenue,abstract"
)

_MAX_PAPERS_DEFAULT = 100
_MAX_PAPERS_CAP = 200
_MAX_COLLABORATORS_DEFAULT = 20
_MAX_COLLABORATORS_CAP = 50
_MIN_SHARED_PAPERS_DEFAULT = 2
_MAX_NODES = 50
_MAX_EDGES = 80
_MAX_PEER_EDGES = 80
_PEER_MIN_SHARED = 2
_TOP_SHARED_PAPERS = 5

# Relationship-hint thresholds
_STRONG_COLLAB_MIN_SHARED = 5
_HIGH_IMPACT_MIN_CITATIONS = 5000
_MENTOR_MIN_SHARED = 3
_MENTOR_MAX_YEAR_SPAN = 6

_GLOBAL_WARNING = (
    "This network is based on coauthorship metadata. "
    "Coauthorship does not imply advisor-student relationships."
)
_EDGE_WARNING = "Coauthorship does not imply an advisor-student relationship."


def _ss_headers() -> dict:
    headers: dict = {}
    if settings.SEMANTIC_SCHOLAR_API_KEY:
        headers["x-api-key"] = settings.SEMANTIC_SCHOLAR_API_KEY
    return headers


def search_author(name: str) -> dict | None:
    """Search Semantic Scholar for the best-matching author.

    Deterministic selection: prefer a last-name match, then higher
    citationCount, then higher paperCount.
    """
    name = (name or "").strip()
    if not name:
        return None
    # SS author/search relevance often ranks fragmented low-citation profiles
    # above the canonical merged author, so fetch a wider window (one call) and
    # let the citation/paper-count tiebreak surface the prominent researcher.
    params = {"query": name, "fields": _SS_AUTHOR_FIELDS, "limit": 25}
    try:
        with _ss_lock:
            resp = requests.get(_SS_AUTHOR_SEARCH_URL, params=params, headers=_ss_headers(), timeout=20)
            if resp.status_code == 429:
                logger.warning("SS author search 429; retrying after 2 s")
                time.sleep(2)
                resp = requests.get(_SS_AUTHOR_SEARCH_URL, params=params, headers=_ss_headers(), timeout=20)
            resp.raise_for_status()
            time.sleep(1.0)
    except Exception as exc:
        logger.error("search_author failed for '%s': %s", name, exc)
        return None

    data = (resp.json() or {}).get("data") or []
    if not data:
        return None

    query_last = name.lower().split()[-1]

    def _score(a: dict) -> tuple:
        a_name = (a.get("name") or "").lower().replace(".", " ").split()
        last_match = query_last in a_name
        return (last_match, a.get("citationCount") or 0, a.get("paperCount") or 0)

    best = max(data, key=_score)
    return {
        "authorId": best.get("authorId") or "",
        "name": best.get("name") or "",
        "affiliations": best.get("affiliations") or [],
        "hIndex": best.get("hIndex"),
        "citationCount": best.get("citationCount") or 0,
        "paperCount": best.get("paperCount") or 0,
    }


def get_author_papers(author_id: str, limit: int = _MAX_PAPERS_DEFAULT) -> list[dict]:
    """Fetch an author's papers, preserving full author list with authorId."""
    url = _SS_AUTHOR_PAPERS_URL.format(author_id=author_id)
    params = {"fields": _SS_PAPER_FIELDS, "limit": min(limit, 1000)}
    try:
        with _ss_lock:
            resp = requests.get(url, params=params, headers=_ss_headers(), timeout=30)
            if resp.status_code == 429:
                logger.warning("SS author papers 429; retrying after 2 s")
                time.sleep(2)
                resp = requests.get(url, params=params, headers=_ss_headers(), timeout=30)
            resp.raise_for_status()
            time.sleep(1.0)
    except Exception as exc:
        logger.error("get_author_papers failed for %s: %s", author_id, exc)
        return []

    return (resp.json() or {}).get("data") or []


def _collect_coauthors(root_id: str, papers: list[dict]) -> dict[str, dict]:
    """Aggregate per-coauthor coauthorship signals from the root author's papers."""
    coauthors: dict[str, dict] = {}

    for paper in papers:
        authors = paper.get("authors") or []
        if not authors:
            continue
        n_authors = len(authors)

        root_pos = next((i for i, a in enumerate(authors) if a.get("authorId") == root_id), None)
        if root_pos is None:
            continue
        root_is_last = root_pos == n_authors - 1

        year = paper.get("year") or None
        pid = paper.get("paperId") or ""
        citations = paper.get("citationCount") or 0
        paper_meta = {
            "paperId": pid,
            "title": paper.get("title") or "",
            "year": year,
            "citationCount": citations,
            "url": f"https://www.semanticscholar.org/paper/{pid}" if pid else "",
        }

        for i, author in enumerate(authors):
            cid = author.get("authorId") or ""
            if not cid or cid == root_id:
                continue

            entry = coauthors.get(cid)
            if entry is None:
                entry = coauthors[cid] = {
                    "authorId": cid,
                    "name": author.get("name") or "",
                    "sharedPaperIds": set(),
                    "sharedYears": set(),
                    "rootLastAuthorCount": 0,
                    "collaboratorFirstAuthorCount": 0,
                    "collaboratorEarlyAuthorCount": 0,
                    "totalSharedCitations": 0,
                    "papers": [],
                }

            if pid in entry["sharedPaperIds"]:
                continue  # count each shared paper once per coauthor
            entry["sharedPaperIds"].add(pid)
            if year:
                entry["sharedYears"].add(year)
            entry["totalSharedCitations"] += citations
            entry["papers"].append(paper_meta)

            if root_is_last:
                entry["rootLastAuthorCount"] += 1
            if i == 0:
                entry["collaboratorFirstAuthorCount"] += 1
            if i <= 1:
                entry["collaboratorEarlyAuthorCount"] += 1

    return coauthors


def _collect_peer_edges(papers: list[dict], collaborator_ids: set[str]) -> list[dict]:
    """Coauthorship edges *between* collaborators (not the root).

    Derived from the root author's papers already in hand (no extra API calls):
    a peer edge means the two collaborators co-appeared on a paper that also
    included the root author. Same factual `coauthored_with` relation.
    """
    pair_counts: dict[tuple[str, str], int] = {}
    for paper in papers:
        present = sorted({
            a.get("authorId") for a in (paper.get("authors") or [])
            if a.get("authorId") in collaborator_ids
        })
        for i in range(len(present)):
            for j in range(i + 1, len(present)):
                key = (present[i], present[j])
                pair_counts[key] = pair_counts.get(key, 0) + 1

    edges = [
        {
            "source": f"author:{a}",
            "target": f"author:{b}",
            "type": "coauthored_with",
            "sharedPaperCount": count,
            "warning": _EDGE_WARNING,
        }
        for (a, b), count in pair_counts.items()
        if count >= _PEER_MIN_SHARED
    ]
    edges.sort(key=lambda e: e["sharedPaperCount"], reverse=True)
    return edges[:_MAX_PEER_EDGES]


def _relationship_hints(root: dict, entry: dict, shared_count: int, year_span: int) -> list[str]:
    """Heuristic, non-factual relationship hints. Never asserts genealogy."""
    hints: list[str] = []

    if shared_count >= _STRONG_COLLAB_MIN_SHARED:
        hints.append("strong_collaborator")

    if entry["totalSharedCitations"] >= _HIGH_IMPACT_MIN_CITATIONS:
        hints.append("high_impact_collaboration")

    # possible_mentor_trainee_pattern requires MULTIPLE coinciding signals.
    repeated = shared_count >= _MENTOR_MIN_SHARED
    root_often_last = entry["rootLastAuthorCount"] >= max(2, shared_count * 0.5)
    collaborator_often_early = entry["collaboratorEarlyAuthorCount"] >= max(2, shared_count * 0.5)
    clustered = 2 <= year_span <= _MENTOR_MAX_YEAR_SPAN
    if repeated and root_often_last and collaborator_often_early and clustered:
        hints.append("possible_mentor_trainee_pattern")

    return hints


def build_coauthor_network(
    root_author_name: str,
    min_shared_papers: int = _MIN_SHARED_PAPERS_DEFAULT,
    max_collaborators: int = _MAX_COLLABORATORS_DEFAULT,
    year_start: int | None = None,
    year_end: int | None = None,
    max_papers: int = _MAX_PAPERS_DEFAULT,
) -> dict:
    """Build a coauthorship network around a root author.

    Caching is handled at the route level (see api/routes/researcher_network.py).
    """
    root_author_name = (root_author_name or "").strip()

    # Normalize / clamp inputs safely (schema stays plain; see plan).
    min_shared_papers = max(1, int(min_shared_papers))
    max_collaborators = min(max(1, int(max_collaborators)), _MAX_COLLABORATORS_CAP)
    max_papers = min(max(1, int(max_papers)), _MAX_PAPERS_CAP)
    if year_start is not None and year_end is not None and year_start > year_end:
        year_start, year_end = year_end, year_start

    empty = {
        "root_author_name": root_author_name,
        "root_author_id": None,
        "root": None,
        "nodes": [],
        "edges": [],
        "cached": False,
        "warning": "No Semantic Scholar author match found.",
    }
    if not root_author_name:
        return empty

    root = search_author(root_author_name)
    if not root or not root["authorId"]:
        return empty
    root_id = root["authorId"]

    papers = get_author_papers(root_id, limit=max_papers)
    if year_start is not None or year_end is not None:
        lo = year_start if year_start is not None else -10**9
        hi = year_end if year_end is not None else 10**9
        papers = [p for p in papers if p.get("year") and lo <= p["year"] <= hi]

    coauthors = _collect_coauthors(root_id, papers)

    # Filter by minimum shared papers, then rank.
    collaborators = [c for c in coauthors.values() if len(c["sharedPaperIds"]) >= min_shared_papers]
    for c in collaborators:
        c["_shared"] = len(c["sharedPaperIds"])
        c["_lastYear"] = max(c["sharedYears"]) if c["sharedYears"] else 0
    collaborators.sort(
        key=lambda c: (c["_shared"], c["totalSharedCitations"], c["_lastYear"]),
        reverse=True,
    )
    collaborators = collaborators[: min(max_collaborators, _MAX_NODES - 1)]

    # Root node
    root_node = {
        "id": f"author:{root_id}",
        "authorId": root_id,
        "type": "person",
        "name": root["name"],
        "affiliations": root["affiliations"],
        "hIndex": root["hIndex"],
        "citationCount": root["citationCount"],
        "paperCount": root["paperCount"],
        "isRoot": True,
    }
    nodes = [root_node]
    edges = []

    for c in collaborators:
        if len(edges) >= _MAX_EDGES:
            break
        cid = c["authorId"]
        years = sorted(c["sharedYears"])
        shared_count = c["_shared"]
        year_span = (years[-1] - years[0] + 1) if len(years) >= 2 else 1
        top_papers = sorted(c["papers"], key=lambda p: p["citationCount"], reverse=True)[:_TOP_SHARED_PAPERS]

        # Collaborator node: affiliations/hIndex not enriched in MVP (avoids
        # one extra API call per collaborator). Documented limitation.
        nodes.append({
            "id": f"author:{cid}",
            "authorId": cid,
            "type": "person",
            "name": c["name"],
            "affiliations": [],
            "hIndex": None,
            "citationCount": 0,
            "paperCount": None,
            "isRoot": False,
        })

        edges.append({
            "source": root_node["id"],
            "target": f"author:{cid}",
            "type": "coauthored_with",
            "sharedPaperCount": shared_count,
            "firstSharedYear": years[0] if years else None,
            "lastSharedYear": years[-1] if years else None,
            "sharedYears": years,
            "rootLastAuthorCount": c["rootLastAuthorCount"],
            "collaboratorFirstAuthorCount": c["collaboratorFirstAuthorCount"],
            "collaboratorEarlyAuthorCount": c["collaboratorEarlyAuthorCount"],
            "totalSharedCitations": c["totalSharedCitations"],
            "topSharedPapers": top_papers,
            "relationshipHints": _relationship_hints(root, c, shared_count, year_span),
            "warning": _EDGE_WARNING,
        })

    collaborator_ids = {c["authorId"] for c in collaborators}
    peer_edges = _collect_peer_edges(papers, collaborator_ids)

    return {
        "root_author_name": root_author_name,
        "root_author_id": root_id,
        "root": root,
        "nodes": nodes,
        "edges": edges,
        "peerEdges": peer_edges,
        "cached": False,
        "warning": _GLOBAL_WARNING,
    }

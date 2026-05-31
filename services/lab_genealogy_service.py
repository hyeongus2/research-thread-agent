"""Lab genealogy candidate inference from publication metadata.

Infers possible lab member / trainee relationships from Semantic Scholar
coauthorship, shared affiliations, author position, and timing patterns.

IMPORTANT: These are metadata-based candidates, not verified advisor-student
relationships. All edges carry an explicit warning to that effect.
"""

import logging
import time
from typing import Optional

import requests

from config.settings import settings
from services.semantic_scholar_service import _ss_lock

logger = logging.getLogger(__name__)

_SS_AUTHOR_SEARCH_URL = "https://api.semanticscholar.org/graph/v1/author/search"
_SS_AUTHOR_PAPERS_URL = "https://api.semanticscholar.org/graph/v1/author/{author_id}/papers"
_SS_AUTHOR_FIELDS = "authorId,name,affiliations,paperCount,citationCount,hIndex"
# authors.affiliations is not supported in the author-papers endpoint;
# affiliation matching is skipped and weights redistributed to other signals.
_SS_PAPER_FIELDS = (
    "paperId,title,year,citationCount,"
    "authors.authorId,authors.name,"
    "publicationVenue,abstract"
)

_MAX_NODES = 30
_MAX_EDGES = 40
_MAX_CANDIDATES_PER_PI = 8
_DEPTH2_EXPAND_TOP_N = 2
_DEPTH2_EXPAND_TOP_N_CAP = 3

_EDGE_WARNING = (
    "Inferred from publication metadata; "
    "not a verified advisor-student relationship."
)


def _ss_headers() -> dict:
    headers = {}
    if settings.SEMANTIC_SCHOLAR_API_KEY:
        headers["x-api-key"] = settings.SEMANTIC_SCHOLAR_API_KEY
    return headers


def _name_group_key(name: str) -> str:
    """Return a grouping key from an author name.

    Maps name variants of the same person to the same key:
      "David Baker", "D. Baker", "D Baker" → "baker_d"
    """
    parts = name.strip().split()
    if not parts:
        return name.lower()
    last = parts[-1].lower().rstrip(".")
    first = parts[0].lower().rstrip(".")
    initial = first[0] if first else ""
    return f"{last}_{initial}"


def _dedup_candidates(raw: list[dict], max_results: int = 5) -> list[dict]:
    """Deduplicate author candidates for autocomplete display.

    Groups by (last_name + first_initial). Within each group keeps the entry
    with the most complete name (longest), falling back to highest citationCount.
    Returns at most max_results items sorted by citationCount descending.
    """
    groups: dict[str, list[dict]] = {}
    for a in raw:
        key = _name_group_key(a["name"])
        groups.setdefault(key, []).append(a)

    result = []
    for group in groups.values():
        # Prefer: full name (longer) > high citationCount
        best = max(group, key=lambda x: (len(x["name"]), x["citationCount"]))
        # Use the max citationCount within the group as the representative value
        best = dict(best)
        best["citationCount"] = max(x["citationCount"] for x in group)
        result.append(best)

    return sorted(result, key=lambda x: x["citationCount"], reverse=True)[:max_results]


def search_author_candidates(name: str, limit: int = 8) -> list[dict]:
    """Return deduplicated author candidates for autocomplete suggestions.

    Intentionally bypasses _ss_lock so autocomplete stays fast and doesn't
    queue behind in-progress genealogy builds.
    """
    if not name or len(name.strip()) < 2:
        return []
    params = {"query": name.strip(), "fields": _SS_AUTHOR_FIELDS, "limit": min(limit, 10)}
    try:
        resp = requests.get(
            _SS_AUTHOR_SEARCH_URL,
            params=params,
            headers=_ss_headers(),
            timeout=8,
        )
        if resp.status_code == 429:
            return []  # Don't retry autocomplete on rate-limit; let user retype
        resp.raise_for_status()

        raw = [
            {
                "authorId": a.get("authorId", ""),
                "name": a.get("name", ""),
                "affiliations": a.get("affiliations") or [],
                "hIndex": a.get("hIndex"),
                "citationCount": a.get("citationCount") or 0,
                "paperCount": a.get("paperCount") or 0,
            }
            for a in resp.json().get("data", [])
            if a.get("authorId") and a.get("name")
        ]
        return _dedup_candidates(raw)
    except Exception as exc:
        logger.error("search_author_candidates failed for '%s': %s", name, exc)
        return []


def search_author(name: str) -> Optional[dict]:
    """Search Semantic Scholar for an author by name.

    Returns the best-matching author dict or None if not found.
    """
    params = {"query": name, "fields": _SS_AUTHOR_FIELDS, "limit": 10}
    try:
        with _ss_lock:
            resp = requests.get(
                _SS_AUTHOR_SEARCH_URL,
                params=params,
                headers=_ss_headers(),
                timeout=20,
            )
            if resp.status_code == 429:
                logger.warning("SS author search 429; retrying after 2 s")
                time.sleep(2)
                resp = requests.get(
                    _SS_AUTHOR_SEARCH_URL,
                    params=params,
                    headers=_ss_headers(),
                    timeout=20,
                )
            resp.raise_for_status()
            time.sleep(1.0)

        data = resp.json().get("data", [])
        if not data:
            return None

        query_last = name.lower().split()[-1]  # last name from query

        def _score(a: dict) -> tuple:
            a_name = a.get("name", "").lower()
            # Last name must match (exact substring) — filters out unrelated people
            last_match = query_last in a_name.replace(".", " ").split()
            cit = a.get("citationCount") or 0
            # Primary: last name match. Secondary: citation count (higher = more prominent researcher)
            return (last_match, cit)

        best = max(data, key=_score)
        return {
            "authorId": best.get("authorId", ""),
            "name": best.get("name", ""),
            "affiliations": best.get("affiliations") or [],
            "hIndex": best.get("hIndex"),
            "citationCount": best.get("citationCount") or 0,
            "paperCount": best.get("paperCount") or 0,
        }
    except Exception as exc:
        logger.error("search_author failed for '%s': %s", name, exc)
        return None


def get_author_papers(author_id: str, limit: int = 100, offset: int = 0) -> list[dict]:
    """Fetch papers for an author from Semantic Scholar."""
    url = _SS_AUTHOR_PAPERS_URL.format(author_id=author_id)
    params = {"fields": _SS_PAPER_FIELDS, "limit": min(limit, 100), "offset": offset}
    try:
        with _ss_lock:
            resp = requests.get(
                url,
                params=params,
                headers=_ss_headers(),
                timeout=30,
            )
            if resp.status_code == 429:
                logger.warning("SS author papers 429; retrying after 2 s")
                time.sleep(2)
                resp = requests.get(
                    url,
                    params=params,
                    headers=_ss_headers(),
                    timeout=30,
                )
            resp.raise_for_status()
            time.sleep(1.0)

        return resp.json().get("data", [])
    except Exception as exc:
        logger.error("get_author_papers failed for %s: %s", author_id, exc)
        return []


def get_author_details(author_id: str) -> Optional[dict]:
    """Fetch author profile (affiliations, hIndex, citationCount) from Semantic Scholar."""
    url = f"https://api.semanticscholar.org/graph/v1/author/{author_id}"
    params = {"fields": "name,affiliations,hIndex,citationCount,paperCount"}
    try:
        with _ss_lock:
            resp = requests.get(url, params=params, headers=_ss_headers(), timeout=15)
            if resp.status_code == 429:
                time.sleep(2)
                resp = requests.get(url, params=params, headers=_ss_headers(), timeout=15)
            if not resp.ok:
                return None
            time.sleep(1.0)
        data = resp.json()
        return {
            "authorId": data.get("authorId", author_id),
            "name": data.get("name", ""),
            "affiliations": data.get("affiliations") or [],
            "hIndex": data.get("hIndex"),
            "citationCount": data.get("citationCount") or 0,
            "paperCount": data.get("paperCount") or 0,
        }
    except Exception as exc:
        logger.error("get_author_details failed for %s: %s", author_id, exc)
        return None



def _infer_lab_candidates(
    root_author: dict,
    root_papers: list[dict],
) -> list[dict]:
    """Infer possible lab member / trainee candidates from root author's papers.

    Uses only the data already present in root_papers — no extra API calls.
    Returns candidates sorted by heuristicScore descending, capped at
    _MAX_CANDIDATES_PER_PI.
    """
    root_id = root_author["authorId"]
    root_citations = root_author.get("citationCount") or 0

    # Collect per-coauthor data from root_papers
    coauthor_data: dict[str, dict] = {}

    for paper in root_papers:
        authors = paper.get("authors") or []
        if not authors:
            continue

        year = paper.get("year") or 0
        n_authors = len(authors)

        # Identify root author position in this paper
        root_pos = None
        for i, a in enumerate(authors):
            if a.get("authorId") == root_id:
                root_pos = i
                break
        if root_pos is None:
            continue

        root_is_last = root_pos == n_authors - 1

        for i, author in enumerate(authors):
            cid = author.get("authorId", "")
            if not cid or cid == root_id:
                continue

            if cid not in coauthor_data:
                coauthor_data[cid] = {
                    "authorId": cid,
                    "name": author.get("name", ""),
                    "affiliations": [],
                    "citationCount": 0,
                    "shared_paper_years": [],
                    "candidate_first_author_count": 0,
                    "root_last_author_count": 0,
                    "shared_paper_titles": [],
                    "shared_paper_ids": [],
                }

            entry = coauthor_data[cid]

            if year:
                entry["shared_paper_years"].append(year)

            # Author position signals
            is_first_or_second = i <= 1
            if is_first_or_second and root_is_last:
                entry["candidate_first_author_count"] += 1
            if root_is_last:
                entry["root_last_author_count"] += 1

            title = paper.get("title") or ""
            if title and title not in entry["shared_paper_titles"]:
                entry["shared_paper_titles"].append(title)

            pid = paper.get("paperId") or ""
            if pid and pid not in entry["shared_paper_ids"]:
                entry["shared_paper_ids"].append(pid)

    candidates = []

    for cid, entry in coauthor_data.items():
        shared_count = len(entry["shared_paper_ids"])
        if shared_count == 0:
            continue

        # Exclude obvious peers by citation parity
        candidate_citations = entry.get("citationCount") or 0
        if root_citations > 0 and candidate_citations > root_citations * 0.8:
            continue

        years = sorted(set(entry["shared_paper_years"]))
        year_span = (max(years) - min(years) + 1) if len(years) >= 2 else 1

        # --- Signal A: Author position (0.45) ---
        # PI appears as last author, candidate as first/second → strong advisor signal.
        # (Affiliation signal removed: authors.affiliations not supported by SS
        # author-papers API endpoint. Weight redistributed to remaining signals.)
        position_ratio = (
            entry["candidate_first_author_count"] / entry["root_last_author_count"]
            if entry["root_last_author_count"] > 0 else 0
        )
        sig_position = min(position_ratio, 1.0) * 0.45

        # --- Signal B: Time clustering (0.35) ---
        # Ideal span: 2–6 years (PhD/postdoc duration)
        if 2 <= year_span <= 6:
            sig_time = 0.35
        elif year_span == 1 and shared_count >= 3:
            sig_time = 0.18
        elif year_span > 6:
            sig_time = max(0.0, 0.35 - (year_span - 6) * 0.05)
        else:
            sig_time = 0.12

        # --- Signal C: Citation asymmetry (0.12) ---
        if root_citations > 0 and candidate_citations > 0:
            ratio = root_citations / candidate_citations
            sig_citation = min(ratio / 5, 1.0) * 0.12
        elif root_citations > 0 and candidate_citations == 0:
            sig_citation = 0.12
        else:
            sig_citation = 0.0

        # --- Signal D: Shared paper volume bonus (0.08) ---
        sig_volume = min(shared_count / 8, 1.0) * 0.08

        score = sig_position + sig_time + sig_citation + sig_volume

        # Minimum shared papers guard
        if shared_count < 2:
            score = min(score, 0.45)

        if score < 0.40:
            continue

        if score >= 0.70:
            confidence = "high"
        elif score >= 0.52:
            confidence = "medium"
        else:
            confidence = "low"

        aff_matches: list[str] = []

        candidates.append({
            "authorId": cid,
            "name": entry["name"],
            "affiliations": entry["affiliations"],
            "citationCount": candidate_citations,
            "heuristicScore": round(score, 4),
            "confidence": confidence,
            "sharedPaperCount": shared_count,
            "sharedPaperYears": years,
            "sharedPaperTitles": entry["shared_paper_titles"][:5],
            "evidence": {
                "sharedPaperCount": shared_count,
                "sharedPaperYears": years,
                "sharedAffiliationMatches": aff_matches,
                "candidateFirstAuthorCount": entry["candidate_first_author_count"],
                "rootLastAuthorCount": entry["root_last_author_count"],
                "postCollaborationIndependentPaperCount": 0,
                "scoreBreakdown": {
                    "authorPosition": round(sig_position, 4),
                    "timeClustering": round(sig_time, 4),
                    "citationAsymmetry": round(sig_citation, 4),
                    "sharedPaperVolume": round(sig_volume, 4),
                },
            },
        })

    candidates.sort(key=lambda c: c["heuristicScore"], reverse=True)
    return candidates[:_MAX_CANDIDATES_PER_PI]


def _infer_advisors(
    root_author: dict,
    root_papers: list[dict],
) -> list[dict]:
    """Infer possible advisors of the root PI from their papers.

    Reverse of _infer_lab_candidates: looks for papers where the root PI
    appears as first/second author and another person appears as last author.
    Returns at most 3 advisor candidates sorted by heuristicScore descending.
    """
    root_id = root_author["authorId"]
    root_citations = root_author.get("citationCount") or 0

    coauthor_data: dict[str, dict] = {}

    for paper in root_papers:
        authors = paper.get("authors") or []
        if not authors:
            continue

        year = paper.get("year") or 0
        n_authors = len(authors)

        root_pos = None
        for i, a in enumerate(authors):
            if a.get("authorId") == root_id:
                root_pos = i
                break
        if root_pos is None:
            continue

        # Root PI must be first or second author (student role)
        root_is_first_or_second = root_pos <= 1
        if not root_is_first_or_second:
            continue

        for i, author in enumerate(authors):
            cid = author.get("authorId", "")
            if not cid or cid == root_id:
                continue

            if cid not in coauthor_data:
                coauthor_data[cid] = {
                    "authorId": cid,
                    "name": author.get("name", ""),
                    "affiliations": [],
                    "citationCount": 0,
                    "shared_paper_years": [],
                    "candidate_last_author_count": 0,   # how often they're last
                    "root_first_author_count": 0,       # how often root is first/2nd
                    "shared_paper_titles": [],
                    "shared_paper_ids": [],
                }

            entry = coauthor_data[cid]
            if year:
                entry["shared_paper_years"].append(year)

            candidate_is_last = (i == n_authors - 1)
            if candidate_is_last:
                entry["candidate_last_author_count"] += 1
            entry["root_first_author_count"] += 1

            title = paper.get("title") or ""
            if title and title not in entry["shared_paper_titles"]:
                entry["shared_paper_titles"].append(title)
            pid = paper.get("paperId") or ""
            if pid and pid not in entry["shared_paper_ids"]:
                entry["shared_paper_ids"].append(pid)

    advisors = []

    for cid, entry in coauthor_data.items():
        shared_count = len(entry["shared_paper_ids"])
        if shared_count == 0:
            continue

        candidate_citations = entry.get("citationCount") or 0
        years = sorted(set(entry["shared_paper_years"]))
        year_span = (max(years) - min(years) + 1) if len(years) >= 2 else 1

        # Signal A: Candidate appears as last author (PI role)
        position_ratio = (
            entry["candidate_last_author_count"] / entry["root_first_author_count"]
            if entry["root_first_author_count"] > 0 else 0
        )
        sig_position = min(position_ratio, 1.0) * 0.50

        # Signal B: Time clustering (2–6 years)
        if 2 <= year_span <= 6:
            sig_time = 0.30
        elif year_span == 1 and shared_count >= 2:
            sig_time = 0.15
        elif year_span > 6:
            sig_time = max(0.0, 0.30 - (year_span - 6) * 0.04)
        else:
            sig_time = 0.10

        # Signal C: Citation asymmetry — advisor should have MORE citations
        if candidate_citations > 0 and root_citations > 0:
            ratio = candidate_citations / root_citations
            sig_citation = min(ratio / 3, 1.0) * 0.12
        elif candidate_citations > root_citations:
            sig_citation = 0.12
        else:
            sig_citation = 0.0

        # Signal D: Shared paper volume
        sig_volume = min(shared_count / 6, 1.0) * 0.08

        score = sig_position + sig_time + sig_citation + sig_volume

        if shared_count < 2:
            score = min(score, 0.45)

        if score < 0.40:
            continue

        if score >= 0.70:
            confidence = "high"
        elif score >= 0.52:
            confidence = "medium"
        else:
            confidence = "low"

        advisors.append({
            "authorId": cid,
            "name": entry["name"],
            "affiliations": [],
            "citationCount": candidate_citations,
            "heuristicScore": round(score, 4),
            "confidence": confidence,
            "sharedPaperCount": shared_count,
            "sharedPaperYears": years,
            "sharedPaperTitles": entry["shared_paper_titles"][:5],
            "evidence": {
                "sharedPaperCount": shared_count,
                "sharedPaperYears": years,
                "sharedAffiliationMatches": [],
                "candidateLastAuthorCount": entry["candidate_last_author_count"],
                "rootFirstAuthorCount": entry["root_first_author_count"],
                "postCollaborationIndependentPaperCount": 0,
                "scoreBreakdown": {
                    "authorPosition": round(sig_position, 4),
                    "timeClustering": round(sig_time, 4),
                    "citationAsymmetry": round(sig_citation, 4),
                    "sharedPaperVolume": round(sig_volume, 4),
                },
            },
        })

    advisors.sort(key=lambda c: c["heuristicScore"], reverse=True)
    return advisors[:3]  # show at most 3 advisor candidates


def _build_node(author: dict, generation_level: int, parent_id: Optional[str]) -> dict:
    if generation_level == 0:
        node_type = "root_pi"
    elif generation_level < 0:
        node_type = "advisor_candidate"
    else:
        node_type = "lab_member_candidate"
    return {
        "authorId": author["authorId"],
        "name": author["name"],
        "affiliations": author.get("affiliations") or [],
        "hIndex": author.get("hIndex"),
        "citationCount": author.get("citationCount") or 0,
        "paperCount": author.get("paperCount") or 0,
        "generationLevel": generation_level,
        "parentAuthorId": parent_id,
        "labFocus": None,
        "confidence": "high" if generation_level == 0 else None,
        "nodeType": node_type,
    }


def _build_edge(source_id: str, target_id: str, candidate: dict) -> dict:
    return {
        "source": source_id,
        "target": target_id,
        "relation": "possible_trainee_or_lab_member",
        "confidence": candidate["confidence"],
        "heuristicScore": candidate["heuristicScore"],
        "sharedPaperCount": candidate["sharedPaperCount"],
        "evidence": candidate["evidence"],
        "warning": _EDGE_WARNING,
    }


def _wd_person_to_node(
    wd: dict,
    generation_level: int,
    parent_id: Optional[str],
    node_type: str,
    ss_data: Optional[dict] = None,
) -> dict:
    """Convert a Wikidata person dict into a graph node."""
    node = {
        "authorId": f"wd:{wd['qid']}",   # prefix to distinguish from SS IDs
        "name": wd["name"],
        "affiliations": wd.get("affiliations") or [],
        "hIndex": None,
        "citationCount": 0,
        "paperCount": None,
        "generationLevel": generation_level,
        "parentAuthorId": parent_id,
        "labFocus": wd.get("description") or None,
        "confidence": "high",   # Wikidata relationships are verified
        "nodeType": node_type,
        "wikidata_url": wd.get("wikidata_url"),
        "wikidata_qid": wd["qid"],
        "source": "wikidata",
    }
    if ss_data:
        node["authorId"] = ss_data.get("authorId") or node["authorId"]
        node["hIndex"] = ss_data.get("hIndex")
        node["citationCount"] = ss_data.get("citationCount") or 0
        node["paperCount"] = ss_data.get("paperCount")
        if ss_data.get("affiliations"):
            node["affiliations"] = ss_data["affiliations"]
    return node


def _wd_edge(source_id: str, target_id: str, relation: str, qid: str) -> dict:
    return {
        "source": source_id,
        "target": target_id,
        "relation": relation,
        "confidence": "high",
        "heuristicScore": 1.0,
        "sharedPaperCount": None,
        "evidence": {
            "source": "wikidata",
            "wikidata_qid": qid,
            "note": "Verified doctoral relationship from Wikidata.",
        },
        "warning": "Relationship sourced from Wikidata (P184/P185). May be incomplete.",
    }


def build_lab_genealogy(
    root_author_name: str,
    max_depth: int = 1,
    lang: str = "en",
    db=None,
) -> dict:
    """Build a lab genealogy graph. Tries Wikidata first (verified relationships),
    falls back to Semantic Scholar co-authorship inference if not found.
    """
    from services.database_service import get_cached_genealogy, save_genealogy
    from services.wikidata_service import (
        search_wikidata_researcher,
        get_wikidata_genealogy,
        get_wikidata_students,
    )

    max_depth = min(max(max_depth, 1), 2)
    root_author_name = root_author_name.strip()

    # --- Step 1: SS lookup (for citations/hIndex enrichment and cache key) ---
    root_ss = search_author(root_author_name)
    root_ss_id = root_ss["authorId"] if root_ss else None
    cache_key = f"genealogy_wd:{root_ss_id or root_author_name}:depth:{max_depth}"

    if db is not None:
        cached = get_cached_genealogy(db, cache_key)
        if cached is not None:
            cached["cached"] = True
            return cached

    graph_nodes: dict[str, dict] = {}
    graph_edges: list[dict] = []

    # --- Step 2: Try Wikidata ---
    wd_person = search_wikidata_researcher(root_author_name)

    if wd_person:
        wd_data = get_wikidata_genealogy(wd_person["qid"])

        # Root node
        root_node_id = root_ss_id or f"wd:{wd_person['qid']}"
        root_node = {
            "authorId": root_node_id,
            "name": wd_person["name"],
            "affiliations": wd_data.get("affiliations") or (root_ss.get("affiliations") if root_ss else []),
            "hIndex": root_ss.get("hIndex") if root_ss else None,
            "citationCount": root_ss.get("citationCount", 0) if root_ss else 0,
            "paperCount": root_ss.get("paperCount") if root_ss else None,
            "generationLevel": 0,
            "parentAuthorId": None,
            "labFocus": wd_person.get("description"),
            "confidence": "high",
            "nodeType": "root_pi",
            "wikidata_url": wd_person.get("wikidata_url"),
            "wikidata_qid": wd_person["qid"],
            "source": "wikidata",
        }
        graph_nodes[root_node_id] = root_node

        # Advisors (generation -1) — use Wikidata data directly, no SS enrichment
        for adv in wd_data["advisors"]:
            if len(graph_nodes) >= _MAX_NODES:
                break
            node = _wd_person_to_node(adv, -1, None, "advisor_candidate")
            nid = node["authorId"]
            if nid not in graph_nodes:
                graph_nodes[nid] = node
                graph_edges.append(_wd_edge(nid, root_node_id, "possible_advisor", adv["qid"]))

        # Students (generation 1) — use Wikidata data directly, no SS enrichment
        for stu in wd_data["students"]:
            if len(graph_nodes) >= _MAX_NODES:
                break
            node = _wd_person_to_node(stu, 1, root_node_id, "lab_member_candidate")
            nid = node["authorId"]
            if nid not in graph_nodes:
                graph_nodes[nid] = node
                graph_edges.append(_wd_edge(root_node_id, nid, "possible_trainee_or_lab_member", stu["qid"]))

        # Depth-2: students' students from Wikidata
        if max_depth == 2:
            d1_nodes = [n for n in graph_nodes.values() if n["generationLevel"] == 1]
            for d1_node in d1_nodes[:_DEPTH2_EXPAND_TOP_N_CAP]:
                if len(graph_nodes) >= _MAX_NODES:
                    break
                d1_qid = d1_node.get("wikidata_qid")
                if not d1_qid:
                    continue
                d2_students = get_wikidata_students(d1_qid)
                for d2 in d2_students:
                    if len(graph_nodes) >= _MAX_NODES:
                        break
                    node = _wd_person_to_node(d2, 2, d1_node["authorId"], "lab_member_candidate")
                    nid = node["authorId"]
                    if nid not in graph_nodes:
                        graph_nodes[nid] = node
                        graph_edges.append(_wd_edge(d1_node["authorId"], nid, "possible_trainee_or_lab_member", d2["qid"]))

        data_source = "wikidata"

    else:
        # --- Step 3: Fallback — SS co-authorship inference ---
        logger.info("Wikidata: no match for '%s', falling back to SS inference", root_author_name)

        if not root_ss:
            return {
                "root_author_name": root_author_name,
                "root_author_id": None,
                "nodes": [], "edges": [],
                "cached": False,
                "warning": "Not found on Wikidata or Semantic Scholar.",
            }

        root_id = root_ss["authorId"]
        root_node = _build_node(root_ss, 0, None)
        graph_nodes[root_id] = root_node

        root_papers = get_author_papers(root_id)
        if not root_papers:
            result = {
                "root_author_name": root_author_name,
                "root_author_id": root_id,
                "nodes": [root_node], "edges": [],
                "cached": False,
                "warning": "No papers found for this author on Semantic Scholar.",
            }
            if db is not None:
                save_genealogy(db, cache_key, result)
            return result

        older_papers = get_author_papers(root_id, offset=100) if (root_ss.get("paperCount") or 0) > 100 else []
        advisor_candidates = _infer_advisors(root_ss, root_papers + older_papers)
        for adv in advisor_candidates:
            aid = adv["authorId"]
            if aid in graph_nodes or len(graph_nodes) >= _MAX_NODES:
                continue
            graph_nodes[aid] = {
                "authorId": aid, "name": adv["name"], "affiliations": [],
                "hIndex": None, "citationCount": adv.get("citationCount") or 0,
                "paperCount": None, "generationLevel": -1, "parentAuthorId": None,
                "labFocus": None, "confidence": adv["confidence"],
                "nodeType": "advisor_candidate", "source": "ss_inference",
            }
            edge = _build_edge(aid, root_id, adv)
            edge["relation"] = "possible_advisor"
            graph_edges.append(edge)

        depth1_candidates = _infer_lab_candidates(root_ss, root_papers)
        for cand in depth1_candidates:
            cid = cand["authorId"]
            if cid in graph_nodes or len(graph_nodes) >= _MAX_NODES:
                continue
            graph_nodes[cid] = {
                "authorId": cid, "name": cand["name"], "affiliations": [],
                "hIndex": None, "citationCount": cand.get("citationCount") or 0,
                "paperCount": None, "generationLevel": 1, "parentAuthorId": root_id,
                "labFocus": None, "confidence": cand["confidence"],
                "nodeType": "lab_member_candidate", "source": "ss_inference",
            }
            graph_edges.append(_build_edge(root_id, cid, cand))

        if max_depth == 2:
            for d1c in [c for c in depth1_candidates if c["confidence"] in ("high", "medium")][:_DEPTH2_EXPAND_TOP_N_CAP]:
                d1id = d1c["authorId"]
                d1papers = get_author_papers(d1id)
                if not d1papers:
                    continue
                for d2c in _infer_lab_candidates({"authorId": d1id, "name": d1c["name"], "affiliations": [], "citationCount": d1c.get("citationCount") or 0}, d1papers):
                    d2id = d2c["authorId"]
                    if d2id in graph_nodes or len(graph_nodes) >= _MAX_NODES:
                        continue
                    graph_nodes[d2id] = {
                        "authorId": d2id, "name": d2c["name"], "affiliations": [],
                        "hIndex": None, "citationCount": d2c.get("citationCount") or 0,
                        "paperCount": None, "generationLevel": 2, "parentAuthorId": d1id,
                        "labFocus": None, "confidence": d2c["confidence"],
                        "nodeType": "lab_member_candidate", "source": "ss_inference",
                    }
                    graph_edges.append(_build_edge(d1id, d2id, d2c))

        # Enrich SS-inferred nodes with author profiles
        for nid, node in graph_nodes.items():
            if nid == root_id or node.get("source") != "ss_inference":
                continue
            try:
                details = get_author_details(nid)
                if details:
                    if details.get("affiliations"):
                        node["affiliations"] = details["affiliations"]
                    if details.get("hIndex") is not None:
                        node["hIndex"] = details["hIndex"]
                    if details.get("citationCount"):
                        node["citationCount"] = details["citationCount"]
            except Exception:
                pass

        data_source = "ss_inference"

    # --- Final assembly ---
    node_list = list(graph_nodes.values())[:_MAX_NODES]
    valid_ids = {n["authorId"] for n in node_list}
    edge_list = [e for e in graph_edges if e["source"] in valid_ids and e["target"] in valid_ids][:_MAX_EDGES]

    result = {
        "root_author_name": root_author_name,
        "root_author_id": root_ss_id,
        "nodes": node_list,
        "edges": edge_list,
        "cached": False,
        "data_source": data_source,
        "warning": None if node_list else "No genealogy data found.",
    }

    if db is not None:
        try:
            save_genealogy(db, cache_key, result)
        except Exception as exc:
            logger.warning("Failed to cache genealogy result: %s", exc)

    return result

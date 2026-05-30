"""OpenAlex venue search — used exclusively by the Venues tab.

OpenAlex primary_location.source.id filtering returns only papers actually published
in the conference proceedings, unlike Semantic Scholar keyword search.

Source IDs are resolved once per process via the OpenAlex Sources API and cached in memory.
"""

import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_OA_BASE = "https://api.openalex.org"

# Human-readable names used for source lookup queries.
_VENUE_OA_NAMES: dict[str, str] = {
    "NeurIPS": "Neural Information Processing Systems",
    "ICML":    "International Conference on Machine Learning",
    "ICLR":    "International Conference on Learning Representations",
    "CVPR":    "Computer Vision and Pattern Recognition",
    "AAAI":    "AAAI Conference on Artificial Intelligence",
    "ECCV":    "European Conference on Computer Vision",
    "ACL":     "Annual Meeting of the Association for Computational Linguistics",
    "EMNLP":   "Empirical Methods in Natural Language Processing",
}

# In-process cache: venue_key -> OpenAlex source ID (or None if lookup failed)
_source_id_cache: dict[str, Optional[str]] = {}


def _resolve_source_id(venue_key: str) -> Optional[str]:
    """Look up the OpenAlex source ID for a venue key.

    Caches the result so only one HTTP request is made per venue per process.
    """
    if venue_key in _source_id_cache:
        return _source_id_cache[venue_key]

    oa_name = _VENUE_OA_NAMES.get(venue_key, venue_key)
    try:
        resp = requests.get(
            f"{_OA_BASE}/sources",
            params={
                "search": venue_key,
                "per-page": 10,
                "mailto": "research-thread-agent@openalex",
            },
            timeout=10,
        )
        resp.raise_for_status()
        sources = resp.json().get("results", [])

        oa_lower = oa_name.lower()
        key_lower = venue_key.lower()
        for src in sources:
            dn = (src.get("display_name") or "").lower()
            if oa_lower in dn or key_lower == dn:
                sid: str = src["id"]  # e.g. "https://openalex.org/S4306463500"
                _source_id_cache[venue_key] = sid
                logger.info("OpenAlex: resolved %s -> %s (%s)", venue_key, sid, src.get("display_name"))
                return sid
    except Exception as exc:
        logger.warning("OpenAlex source ID lookup failed for %s: %s", venue_key, exc)

    _source_id_cache[venue_key] = None
    return None


def _reconstruct_abstract(inverted_index: Optional[dict]) -> str:
    """Convert OpenAlex inverted-index abstract to a plain string."""
    if not inverted_index:
        return ""
    max_pos = max(pos for positions in inverted_index.values() for pos in positions)
    words = [""] * (max_pos + 1)
    for word, positions in inverted_index.items():
        for pos in positions:
            if pos <= max_pos:
                words[pos] = word
    return " ".join(w for w in words if w)


def search_papers_by_venue(venue_key: str, year: int, limit: int = 50) -> list[dict]:
    """Return papers published at *venue_key* in *year*, sorted by citation count.

    Source ID is resolved first for precise venue matching, falling back to
    display_name search if the source lookup fails.
    """
    source_id = _resolve_source_id(venue_key)

    if source_id:
        filter_str = f"primary_location.source.id:{source_id},publication_year:{year}"
    else:
        # Fallback: less precise but won't hard-fail
        oa_name = _VENUE_OA_NAMES.get(venue_key, venue_key)
        filter_str = f"primary_location.source.display_name.search:{oa_name},publication_year:{year}"
        logger.warning("Using display_name fallback for %s (source ID not resolved)", venue_key)

    per_page = min(limit, 200)
    params = {
        "filter": filter_str,
        "sort": "cited_by_count:desc",
        "per-page": per_page,
        "select": (
            "title,authorships,publication_year,cited_by_count,"
            "primary_location,abstract_inverted_index,doi,open_access"
        ),
        "mailto": "research-thread-agent@openalex",
    }

    try:
        resp = requests.get(f"{_OA_BASE}/works", params=params, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.error("OpenAlex venue fetch failed for %s %d: %s", venue_key, year, exc)
        return []

    results: list[dict] = []
    for work in data.get("results", []):
        authors = [
            a["author"]["display_name"]
            for a in work.get("authorships", [])[:6]
            if a.get("author") and a["author"].get("display_name")
        ]

        loc = work.get("primary_location") or {}
        source = loc.get("source") or {}
        oa_info = work.get("open_access") or {}

        pdf_url: str = oa_info.get("oa_url") or ""
        landing_url: str = loc.get("landing_page_url") or ""
        doi: str = work.get("doi") or ""
        doi_url = doi if doi.startswith("http") else (f"https://doi.org/{doi}" if doi else "")
        url = landing_url or doi_url or pdf_url

        abstract = _reconstruct_abstract(work.get("abstract_inverted_index"))

        results.append({
            "title": work.get("title") or "",
            "authors": authors,
            "abstract": abstract[:1200],
            "url": url,
            "pdf_url": pdf_url,
            "published_date": str(year),
            "citation_count": work.get("cited_by_count") or 0,
            "venue": source.get("display_name") or venue_key,
            "source": "openalex",
        })

    return results

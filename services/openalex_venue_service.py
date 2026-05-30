"""OpenAlex venue search — used exclusively by the Venues tab.

OpenAlex supports filtering by primary_location.source.display_name, which maps
directly to the conference proceedings source. This gives accurate venue results
that Semantic Scholar keyword search cannot provide.
"""

import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_OA_BASE = "https://api.openalex.org"

# OpenAlex source display names for each venue key.
# These match the exact strings OpenAlex uses in primary_location.source.display_name.
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

    Uses OpenAlex primary_location.source filter for accurate venue matching —
    returns only papers actually published in the conference proceedings.
    """
    oa_name = _VENUE_OA_NAMES.get(venue_key, venue_key)
    per_page = min(limit, 200)

    params = {
        "filter": f"primary_location.source.display_name.search:{oa_name},publication_year:{year}",
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

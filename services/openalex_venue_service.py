"""Venue-based paper search using Semantic Scholar bulk search API.

Uses /paper/search/bulk with the `venue` filter parameter, which directly filters
by publication venue — no keyword-based workarounds or post-processing needed.
"""

import logging
import threading
import time
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_SS_BULK_URL = "https://api.semanticscholar.org/graph/v1/paper/search/bulk"
_SS_FIELDS = "title,authors,abstract,year,citationCount,venue,externalIds,openAccessPdf,publicationVenue"

# SS tags the same conference differently across years — try aliases in order until results found.
_VENUE_ALIASES: dict[str, list[str]] = {
    "NeurIPS": [
        "NeurIPS",
        "Neural Information Processing Systems",
        "Advances in Neural Information Processing Systems",
    ],
    "ICML": ["ICML", "International Conference on Machine Learning"],
    "ICLR": ["ICLR", "International Conference on Learning Representations"],
    "CVPR": ["CVPR", "Computer Vision and Pattern Recognition", "IEEE/CVF Conference on Computer Vision and Pattern Recognition"],
    "AAAI": ["AAAI", "AAAI Conference on Artificial Intelligence"],
    "ECCV": ["ECCV", "European Conference on Computer Vision"],
    "ACL": ["ACL", "Annual Meeting of the Association for Computational Linguistics"],
    "EMNLP": ["EMNLP", "Empirical Methods in Natural Language Processing", "Conference on Empirical Methods in Natural Language Processing"],
}

_lock = threading.Lock()
_last_request_time: float = 0.0


def _ss_get(params: dict) -> dict:
    """Rate-limited GET to Semantic Scholar bulk search."""
    global _last_request_time
    with _lock:
        elapsed = time.time() - _last_request_time
        if elapsed < 1.0:
            time.sleep(1.0 - elapsed)
        resp = requests.get(_SS_BULK_URL, params=params, timeout=20)
        _last_request_time = time.time()
    resp.raise_for_status()
    return resp.json()


def search_papers_by_venue(venue_key: str, year: int, limit: int = 50) -> list[dict]:
    """Return top papers from *venue_key* in *year*, sorted by citation count.

    Tries each alias in _VENUE_ALIASES until results are found, to handle
    SS tagging the same conference with different strings across years.
    """
    aliases = _VENUE_ALIASES.get(venue_key, [venue_key])
    raw_data: list = []
    for alias in aliases:
        try:
            data = _ss_get({
                "venue": alias,
                "year": str(year),
                "fields": _SS_FIELDS,
                "sort": "citationCount:desc",
                "limit": min(limit, 500),
            })
            raw_data = data.get("data", [])
            if raw_data:
                break
        except Exception as exc:
            logger.error("SS bulk venue fetch failed for %s (%s) %d: %s", venue_key, alias, year, exc)

    results: list[dict] = []
    for p in raw_data[:limit]:
        authors = [a.get("name", "") for a in (p.get("authors") or [])[:6]]
        ext = p.get("externalIds") or {}
        oa = p.get("openAccessPdf") or {}

        arxiv_id = ext.get("ArXiv")
        pdf_url = oa.get("url") or (f"https://arxiv.org/abs/{arxiv_id}" if arxiv_id else "")
        url = (f"https://arxiv.org/abs/{arxiv_id}" if arxiv_id
               else f"https://www.semanticscholar.org/paper/{p.get('paperId', '')}")

        results.append({
            "title": p.get("title") or "",
            "authors": authors,
            "abstract": (p.get("abstract") or "")[:1200],
            "url": url,
            "pdf_url": pdf_url,
            "published_date": str(p.get("year") or year),
            "citation_count": p.get("citationCount") or 0,
            "venue": p.get("venue") or venue_key,
            "source": "semantic_scholar",
        })

    return results

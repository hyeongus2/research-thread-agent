"""Semantic Scholar API integration for paper search."""

import time
from datetime import date
from typing import Optional

import requests

from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

_BASE_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
_FIELDS = (
    "title,authors,year,citationCount,publicationVenue,"
    "externalIds,abstract,openAccessPdf,publicationDate"
)


def search_papers(
    keyword: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 100,
) -> list[dict]:
    """Search Semantic Scholar for papers relevant to keyword.

    Fetches by relevance (Semantic Scholar's default ranking), then sorts
    client-side by citation count so highly-cited relevant papers rise to top.

    Args:
        keyword: Search query string.
        start_date: Filter to papers published on or after this year.
        end_date: Filter to papers published on or before this year.
        limit: Maximum papers to return (Semantic Scholar hard cap: 100/request).

    Returns:
        List of paper dicts: title, authors, abstract, url, pdf_url,
        published_date, citation_count, venue. Sorted by citation_count desc.
    """
    params: dict = {
        "query": keyword,
        "limit": min(limit, 100),
        "fields": _FIELDS,
    }

    if start_date or end_date:
        year_from = str(start_date.year) if start_date else ""
        year_to = str(end_date.year) if end_date else ""
        params["year"] = f"{year_from}-{year_to}"

    headers = {}
    if settings.SEMANTIC_SCHOLAR_API_KEY:
        headers["x-api-key"] = settings.SEMANTIC_SCHOLAR_API_KEY

    try:
        resp = requests.get(_BASE_URL, params=params, headers=headers, timeout=30)
        if resp.status_code == 429:
            logger.warning("Semantic Scholar rate limited; retrying after 10 s")
            time.sleep(10)
            resp = requests.get(_BASE_URL, params=params, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        logger.error("Semantic Scholar request failed: %s", exc)
        raise

    papers = []
    for p in data.get("data", []):
        paper_id = p.get("paperId") or ""
        url = f"https://www.semanticscholar.org/paper/{paper_id}" if paper_id else ""
        pdf_url = (p.get("openAccessPdf") or {}).get("url") or ""
        venue_obj = p.get("publicationVenue") or {}
        venue = venue_obj.get("name") or ""
        pub_date = p.get("publicationDate") or (str(p["year"]) if p.get("year") else "")
        authors = [a.get("name", "") for a in (p.get("authors") or [])[:5]]

        papers.append({
            "title": p.get("title") or "",
            "authors": authors,
            "abstract": p.get("abstract") or "",
            "url": url,
            "pdf_url": pdf_url,
            "published_date": pub_date,
            "citation_count": p.get("citationCount") or 0,
            "venue": venue,
        })

    papers.sort(key=lambda x: x.get("citation_count", 0), reverse=True)
    logger.info("Semantic Scholar '%s' → %d papers", keyword, len(papers))
    return papers

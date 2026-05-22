"""Hugging Face Daily Papers fetcher."""

import requests
from datetime import date as _date
from utils.logger import get_logger

logger = get_logger(__name__)

_HF_DAILY_URL = "https://huggingface.co/api/daily_papers"
_TIMEOUT = 15


def fetch_daily_papers(target_date: _date | None = None) -> list[dict]:
    """Fetch HF Daily Papers for a given date (default: today).

    Returns a list of paper dicts with keys:
        title, summary, upvotes, arxiv_id, url, published_at, authors
    """
    params = {}
    if target_date is not None:
        params["date"] = target_date.isoformat()

    try:
        resp = requests.get(_HF_DAILY_URL, params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        raw = resp.json()
    except Exception as exc:
        logger.warning("HF Daily Papers fetch failed: %s", exc)
        return []

    papers = []
    for entry in raw:
        paper = entry.get("paper") or entry
        arxiv_id = paper.get("id", "")
        url = f"https://arxiv.org/abs/{arxiv_id}" if arxiv_id else entry.get("url", "#")
        authors = [a.get("name", "") for a in (paper.get("authors") or [])]
        papers.append({
            "title": paper.get("title", ""),
            "summary": paper.get("summary", ""),
            "upvotes": entry.get("upvotes") or paper.get("upvotes") or 0,
            "arxiv_id": arxiv_id,
            "url": url,
            "published_at": paper.get("publishedAt", ""),
            "authors": authors,
        })

    papers.sort(key=lambda p: p["upvotes"], reverse=True)
    return papers

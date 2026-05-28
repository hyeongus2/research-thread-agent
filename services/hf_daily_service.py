"""Hugging Face Daily Papers fetcher."""

import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

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


def fetch_papers_range(days: int = 1) -> list[dict]:
    """Fetch HF Daily Papers for the past N days, deduplicated by arxiv_id.

    Papers with no arxiv_id are kept but deduplicated by title.
    Returns all papers sorted by upvotes descending.
    """
    # HF Daily Papers operates on UTC dates; using local date can return 0-1 papers
    # in timezones ahead of UTC (e.g. KST = UTC+9).
    today = datetime.datetime.now(datetime.timezone.utc).date()
    dates = [today - datetime.timedelta(days=i) for i in range(days)]

    seen: dict[str, dict] = {}  # arxiv_id or title -> paper with max upvotes

    with ThreadPoolExecutor(max_workers=min(days, 7)) as ex:
        futures = [ex.submit(fetch_daily_papers, d) for d in dates]
        for f in as_completed(futures):
            for p in f.result():
                key = p["arxiv_id"] or p["title"]
                if not key:
                    continue
                if key not in seen or p["upvotes"] > seen[key]["upvotes"]:
                    seen[key] = p

    return sorted(seen.values(), key=lambda p: p["upvotes"], reverse=True)

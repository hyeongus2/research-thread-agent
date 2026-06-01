import datetime
import time

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.notification import Notification
from services.hf_daily_service import fetch_papers_range, fetch_daily_papers
from services.figure_service import fetch_first_figure
from utils.database import get_db

router = APIRouter()

_PERIOD_DAYS = {"daily": 1, "weekly": 7, "monthly": 30}

_TTL = 86400  # 24 h for all trending periods
# cache stores (response_dict, expires_at) so fallback_days is preserved
_cache: dict[str, tuple[dict, float]] = {}

# per-user my-feed cache: user_id -> (papers_list, expires_at_unix)
_myfeed_cache: dict[int, tuple[list, float]] = {}

# figure cache: arxiv_id -> (figure_url_or_None, fetched_at_unix)
# None values are cached too so we don't keep retrying papers without ar5iv pages.
_FIGURE_TTL = 7 * 86400  # 7 days
_figure_cache: dict[str, tuple[str | None, float]] = {}


@router.get("/feed/trending")
def trending_feed(period: str = "daily"):
    now = time.time()
    if period in _cache:
        cached_resp, expires_at = _cache[period]
        if now < expires_at:
            return {**cached_resp, "cached": True}

    days = _PERIOD_DAYS.get(period, 1)
    papers = fetch_papers_range(days)
    fallback_days = 0

    # Weekend/holiday fallback: if today has no papers, scan back up to 7 days
    if period == "daily" and not papers:
        today = datetime.datetime.now(datetime.timezone.utc).date()
        for delta in range(1, 8):
            day = today - datetime.timedelta(days=delta)
            fallback = fetch_daily_papers(day)
            if fallback:
                papers = sorted(fallback, key=lambda p: p["upvotes"], reverse=True)
                fallback_days = delta
                break

    resp = {"papers": papers, "fallback_days": fallback_days}
    if papers:
        _cache[period] = (resp, now + _TTL)
    return {**resp, "cached": False}


@router.get("/feed/my-feed")
def my_feed(user_id: int, db: Session = Depends(get_db)):
    """Return notification-based papers for the user, sorted by citation count."""
    now = time.time()
    if user_id in _myfeed_cache:
        cached_data, expires_at = _myfeed_cache[user_id]
        if now < expires_at:
            return {"papers": cached_data, "cached": True}

    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .all()
    )
    papers = []
    seen = set()
    for n in notifs:
        url = n.source_url or ""
        if url in seen:
            continue
        seen.add(url)
        ts = n.created_at.strftime('%Y-%m-%dT%H:%M:%SZ') if n.created_at else ""
        papers.append({
            "id": n.id,
            "title": n.title,
            "abstract": n.content or "",
            "topic": n.topic or "",
            "url": url,
            "is_read": n.is_read,
            "created_at": ts,
            "citation_count": n.citation_count or 0,
        })

    papers.sort(key=lambda x: x["citation_count"], reverse=True)
    papers = papers[:100]

    if papers:
        _myfeed_cache[user_id] = (papers, now + _TTL)
    return {"papers": papers, "cached": False}


@router.get("/figure/{arxiv_id:path}")
def get_paper_figure(arxiv_id: str):
    """Return the first figure URL for an arXiv paper, parsed from ar5iv.

    Cached for 7 days per arxiv_id. None results are cached too so we don't
    keep retrying papers without ar5iv pages.

    Response:
        {"arxiv_id": "...", "figure_url": "https://..." | null, "cached": bool}
    """
    arxiv_id = arxiv_id.strip()
    now = time.time()

    cached = _figure_cache.get(arxiv_id)
    if cached is not None:
        url, fetched_at = cached
        if now - fetched_at < _FIGURE_TTL:
            return {"arxiv_id": arxiv_id, "figure_url": url, "cached": True}

    url = fetch_first_figure(arxiv_id)
    _figure_cache[arxiv_id] = (url, now)
    return {"arxiv_id": arxiv_id, "figure_url": url, "cached": False}

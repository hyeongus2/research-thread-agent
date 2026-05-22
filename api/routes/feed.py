import time

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.notification import Notification
from services.hf_daily_service import fetch_papers_range
from utils.database import get_db

router = APIRouter()

_PERIOD_DAYS = {"daily": 1, "weekly": 7, "monthly": 30}

_TTL = 86400  # 24 h for all trending periods
_cache: dict[str, tuple[list, float]] = {}

# per-user my-feed cache: user_id -> (papers_list, expires_at_unix)
_myfeed_cache: dict[int, tuple[list, float]] = {}


@router.get("/feed/trending")
def trending_feed(period: str = "daily"):
    now = time.time()
    if period in _cache:
        cached_data, expires_at = _cache[period]
        if now < expires_at:
            return {"papers": cached_data, "cached": True}

    days = _PERIOD_DAYS.get(period, 1)
    papers = fetch_papers_range(days)
    _cache[period] = (papers, now + _TTL)
    return {"papers": papers, "cached": False}


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

    _myfeed_cache[user_id] = (papers, now + _TTL)
    return {"papers": papers, "cached": False}

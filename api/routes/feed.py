import datetime
import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.notification import Notification
from models.thread import HistoricalThread
from services.hf_daily_service import fetch_papers_range, fetch_daily_papers
from utils.database import get_db

router = APIRouter()

_PERIOD_DAYS = {"daily": 1, "weekly": 7, "monthly": 30}
_TRENDING_KEY_PREFIX = "trending:"



def _get_trending_cache(db: Session, period: str) -> dict | None:
    key = f"{_TRENDING_KEY_PREFIX}{period}"
    record = db.query(HistoricalThread).filter(HistoricalThread.topic == key).first()
    if not record:
        return None
    today = datetime.datetime.now(datetime.timezone.utc).date()
    if record.updated_at.date() != today:
        return None
    return json.loads(record.data) if record.data else None


def _save_trending_cache(db: Session, period: str, data: dict) -> None:
    key = f"{_TRENDING_KEY_PREFIX}{period}"
    record = db.query(HistoricalThread).filter(HistoricalThread.topic == key).first()
    if record:
        record.data = json.dumps(data)
        record.updated_at = datetime.datetime.utcnow()
    else:
        record = HistoricalThread(topic=key, data=json.dumps(data))
        db.add(record)
    db.commit()


@router.get("/feed/trending")
def trending_feed(period: str = "daily", db: Session = Depends(get_db)):
    cached = _get_trending_cache(db, period)
    if cached:
        return {**cached, "cached": True}

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
        _save_trending_cache(db, period, resp)
    return {**resp, "cached": False}


@router.get("/feed/my-feed")
def my_feed(user_id: int, db: Session = Depends(get_db)):
    """Return notification-based papers for the user, sorted by citation count."""
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
    return {"papers": papers, "cached": False}

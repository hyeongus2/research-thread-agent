from fastapi import APIRouter
from services.hf_daily_service import fetch_papers_range

router = APIRouter()

_PERIOD_DAYS = {"daily": 1, "weekly": 7}


@router.get("/feed/trending")
def trending_feed(period: str = "daily"):
    """Return HF Daily Papers sorted by upvotes. period: 'daily' | 'weekly'."""
    days = _PERIOD_DAYS.get(period, 1)
    papers = fetch_papers_range(days)
    return {"papers": papers}

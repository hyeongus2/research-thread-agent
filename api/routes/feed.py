from fastapi import APIRouter
from services.hf_daily_service import fetch_daily_papers

router = APIRouter()


@router.get("/feed/trending")
def trending_feed():
    """Return today's HF Daily Papers sorted by upvotes."""
    papers = fetch_daily_papers()
    return {"papers": papers}

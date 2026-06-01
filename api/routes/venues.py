"""Venue-based paper browsing: list major ML venues and fetch papers by venue/year."""

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from services.semantic_scholar_service import search_papers
from utils.database import get_db

router = APIRouter()

VENUES = [
    {"key": "NeurIPS", "label": "NeurIPS", "field": "ML"},
    {"key": "ICML",    "label": "ICML",    "field": "ML"},
    {"key": "ICLR",    "label": "ICLR",    "field": "ML"},
    {"key": "CVPR",    "label": "CVPR",    "field": "Vision"},
    {"key": "AAAI",    "label": "AAAI",    "field": "AI"},
    {"key": "ECCV",    "label": "ECCV",    "field": "Vision"},
    {"key": "ACL",     "label": "ACL",     "field": "NLP"},
    {"key": "EMNLP",   "label": "EMNLP",   "field": "NLP"},
]

YEARS = list(range(2025, 2019, -1))  # 2025..2020


@router.get("/venues")
def list_venues():
    return {"venues": VENUES, "years": YEARS}


@router.get("/venues/papers")
def venues_papers(
    venue: str,
    year: int,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    papers = search_papers(
        keyword=venue,
        start_date=date(year, 1, 1),
        end_date=date(year, 12, 31),
        limit=min(limit, 100),
    )
    # attach code links if PWC data has been imported
    try:
        from api.routes.search import _attach_code_links
        _attach_code_links(papers, db)
    except Exception:
        pass

    return {"venue": venue, "year": year, "papers": papers}

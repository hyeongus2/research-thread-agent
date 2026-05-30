"""Venue-based paper browsing: list major ML venues and fetch papers by venue/year."""

import logging
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from services.openalex_venue_service import search_papers_by_venue
from utils.database import get_db

logger = logging.getLogger(__name__)

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


@router.get("/venues")
def list_venues():
    current_year = date.today().year
    years = list(range(current_year, 2009, -1))
    return {"venues": VENUES, "years": years}


@router.get("/venues/papers")
def venues_papers(
    venue: str,
    year: int,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    papers = search_papers_by_venue(venue_key=venue, year=year, limit=limit)

    # attach code links if PWC data has been imported
    try:
        from api.routes.search import _attach_code_links
        _attach_code_links(papers, db)
    except Exception as exc:
        logger.warning("Code link attachment skipped: %s", exc)

    return {"venue": venue, "year": year, "papers": papers}

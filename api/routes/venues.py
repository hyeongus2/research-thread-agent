"""Venue-based paper browsing: list major ML venues and fetch papers by venue/year."""

import logging
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from services.semantic_scholar_service import search_papers
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

# Aliases used in Semantic Scholar venue metadata for each venue key.
_VENUE_ALIASES: dict[str, list[str]] = {
    "NeurIPS": ["neurips", "nips", "neural information processing systems"],
    "ICML":    ["icml", "international conference on machine learning"],
    "ICLR":    ["iclr", "international conference on learning representations"],
    "CVPR":    ["cvpr", "computer vision and pattern recognition"],
    "AAAI":    ["aaai", "association for the advancement of artificial intelligence"],
    "ECCV":    ["eccv", "european conference on computer vision"],
    "ACL":     ["acl", "annual meeting of the association for computational linguistics"],
    "EMNLP":   ["emnlp", "empirical methods in natural language processing"],
}


def _venue_matches(paper_venue: str, venue_key: str) -> bool:
    """Return True if the paper's venue field matches the requested venue."""
    pv = (paper_venue or "").lower()
    return any(alias in pv for alias in _VENUE_ALIASES.get(venue_key, [venue_key.lower()]))


@router.get("/venues")
def list_venues():
    current_year = date.today().year
    years = list(range(current_year, 2009, -1))  # current year back to 2010
    return {"venues": VENUES, "years": years}


@router.get("/venues/papers")
def venues_papers(
    venue: str,
    year: int,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    # Fetch more than needed so post-filtering still yields enough results.
    raw = search_papers(
        keyword=venue,
        start_date=date(year, 1, 1),
        end_date=date(year, 12, 31),
        limit=min(limit * 3, 100),
    )

    # Keep only papers whose venue metadata actually matches the requested venue.
    papers = [p for p in raw if _venue_matches(p.get("venue", ""), venue)]

    # If filtering leaves too few results, fall back to the unfiltered set with a warning.
    if not papers:
        logger.warning("Venue filter for '%s' removed all results — returning unfiltered", venue)
        papers = raw

    papers = papers[:limit]

    # attach code links if PWC data has been imported
    try:
        from api.routes.search import _attach_code_links
        _attach_code_links(papers, db)
    except Exception as exc:
        logger.warning("Code link attachment skipped: %s", exc)

    return {"venue": venue, "year": year, "papers": papers}

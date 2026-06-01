"""MCP server exposing Research Thread Agent tools to Claude.ai."""

import sys
import os
import logging

# Set working directory to project root before any project imports,
# because utils/database.py creates "data/" relative to cwd.
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
os.chdir(_PROJECT_ROOT)
sys.path.insert(0, _PROJECT_ROOT)

from datetime import date, timedelta
from typing import Optional

from mcp.server.fastmcp import FastMCP

from services.thread_service import create_research_thread
from services.historical_thread_service import build_learning_path
from services.hf_daily_service import fetch_papers_range
from services.openalex_venue_service import search_papers_by_venue
from utils.database import SessionLocal

mcp = FastMCP("Research Thread Agent", log_level="ERROR")

# Force ALL logging handlers (including ones FastMCP just added) to use stderr.
# MCP uses stdout exclusively for JSON-RPC; any log on stdout breaks the protocol.
logging.basicConfig(stream=sys.stderr, level=logging.WARNING, force=True)
for _lgr in [logging.root] + list(logging.Logger.manager.loggerDict.values()):
    if isinstance(_lgr, logging.Logger):
        for _h in _lgr.handlers:
            if hasattr(_h, "stream") and _h.stream is sys.stdout:
                _h.stream = sys.stderr

VENUES = ["NeurIPS", "ICML", "ICLR", "CVPR", "AAAI", "ECCV", "ACL", "EMNLP"]


def _period_dates(period: str) -> tuple[Optional[date], Optional[date]]:
    """Convert a period string to (start_date, end_date)."""
    today = date.today()
    if period == "week":
        return today - timedelta(days=7), today
    if period == "month":
        return today - timedelta(days=30), today
    if period == "three_months":
        return today - timedelta(days=90), today
    return None, None  # "all"


@mcp.tool()
def quick_search(
    keyword: str,
    period: str = "month",
    paper_limit: int = 20,
    model_limit: int = 10,
    repo_limit: int = 10,
) -> dict:
    """Search for recent AI/ML papers, models, and repos by keyword.

    Args:
        keyword: Search query (e.g. "retrieval augmented generation").
        period: Time filter — "week", "month", "three_months", or "all".
        paper_limit: Max papers to return (max 100).
        model_limit: Max HuggingFace models to return (max 50).
        repo_limit: Max GitHub repos to return (max 50).

    Returns:
        Dict with keys "papers", "models", "repos", each a list of results.
        Papers sorted by citation count, models by downloads, repos by stars.
    """
    start, end = _period_dates(period)
    db = SessionLocal()
    try:
        result = create_research_thread(
            keyword=keyword,
            start_date=start,
            end_date=end,
            user_id=1,
            db=db,
            paper_limit=min(paper_limit, 100),
            model_limit=min(model_limit, 50),
            repo_limit=min(repo_limit, 50),
        )
    finally:
        db.close()
    return {
        "keyword": result.get("keyword", keyword),
        "papers": result.get("papers", []),
        "models": result.get("models", []),
        "repos": result.get("repos", []),
    }


@mcp.tool()
def learning_path(
    topic: str,
    lang: str = "en",
) -> dict:
    """Build a chronological learning path for an AI/ML research topic.

    Groups key papers into eras (Before 2018 / 2018-2020 / 2021-2022 / …),
    with a Claude-generated summary of what changed in each era.
    Results are cached for 90 days — repeat calls return instantly.

    Args:
        topic: Research topic (e.g. "transformer", "diffusion models").
        lang: Response language — "en" or "ko".

    Returns:
        Dict with "topic", "eras" (list of era dicts with papers/models/repos
        and an AI-generated summary), and "year_range".
    """
    db = SessionLocal()
    try:
        result = build_learning_path(topic=topic, db=db, lang=lang)
    finally:
        db.close()
    return result


@mcp.tool()
def trending_papers(period: str = "daily") -> list[dict]:
    """Fetch trending AI/ML papers from Hugging Face Daily Papers.

    Args:
        period: "daily" (today), "weekly" (last 7 days), or "monthly" (last 30 days).

    Returns:
        List of paper dicts sorted by upvotes, each with title, abstract,
        authors, arxiv_id, upvotes, and published_date.
    """
    days = {"daily": 1, "weekly": 7, "monthly": 30}.get(period, 1)
    return fetch_papers_range(days=days)


@mcp.tool()
def venue_papers(
    venue: str,
    year: int,
    limit: int = 20,
) -> dict:
    """Fetch papers from a major ML/AI conference for a given year.

    Args:
        venue: Conference name — one of: NeurIPS, ICML, ICLR, CVPR, AAAI, ECCV, ACL, EMNLP.
        year: Publication year (2020–2025).
        limit: Max papers to return (max 50).

    Returns:
        Dict with "venue", "year", and "papers" list sorted by citation count.
    """
    if venue not in VENUES:
        return {"error": f"Unknown venue '{venue}'. Choose from: {', '.join(VENUES)}"}
    current_year = date.today().year
    if not (2020 <= year <= current_year):
        return {"error": f"Year must be between 2020 and {current_year}."}
    papers = search_papers_by_venue(venue_key=venue, year=year, limit=min(limit, 50))
    return {"venue": venue, "year": year, "papers": papers}


if __name__ == "__main__":
    mcp.run()

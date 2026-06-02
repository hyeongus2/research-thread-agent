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
from services.citation_graph_service import build_citation_graph
from models.notification import Notification
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


@mcp.tool()
def research_lineage(
    query: str,
    min_citations: int = 0,
) -> dict:
    """Build a citation-based research lineage graph for an AI/ML topic.

    Fetches top 100 papers from Semantic Scholar, identifies the top-5 most
    cited as influential "seed" papers, and maps citation edges between them.

    Args:
        query: Research topic or paper title (e.g. "attention mechanism transformer").
        min_citations: Minimum citation count to include a paper (default 0).

    Returns:
        Dict with:
          - "query": the search query used
          - "nodes": list of papers, each with title, year, authors, venue,
            citationCount, type ("seed" = influential / "reference" = related),
            importanceScore, and url
          - "edges": list of citation relationships {source_title, target_title,
            isInfluential} where source cites target
          - "summary": human-readable text summary of the lineage
    """
    graph = build_citation_graph(query, min_citations=min_citations)

    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    if not nodes:
        return {
            "query": query,
            "nodes": [],
            "edges": [],
            "summary": graph.get("warning", "No results found."),
        }

    # Map paper_id → title for readable edge labels
    id_to_title = {n["id"]: n["title"] for n in nodes}

    readable_edges = [
        {
            "source_title": id_to_title.get(e["source"], e["source"]),
            "target_title": id_to_title.get(e["target"], e["target"]),
            "isInfluential": e.get("isInfluential", False),
        }
        for e in edges
    ]

    seeds = [n for n in nodes if n["type"] == "seed"]
    refs = [n for n in nodes if n["type"] == "reference"]

    summary_lines = [
        f"Research lineage for '{query}': {len(nodes)} papers, {len(edges)} citation links.",
        f"Top {len(seeds)} influential papers (seed nodes):",
    ]
    for s in seeds:
        summary_lines.append(
            f"  - [{s['year']}] {s['title']} — {s['citationCount']:,} citations"
            + (f" ({s['venue']})" if s.get("venue") else "")
        )
    if refs:
        summary_lines.append(f"{len(refs)} related papers connected via citations.")

    return {
        "query": query,
        "nodes": nodes,
        "edges": readable_edges,
        "summary": "\n".join(summary_lines),
    }


@mcp.tool()
def my_feed(
    user_id: int = 1,
    limit: int = 50,
    unread_only: bool = False,
) -> dict:
    """Fetch your personalized paper alerts from the local database.

    Returns papers already saved by the app (via My Feed tab or background scheduler).
    The database is updated when you open the app and navigate to the My Feed tab.

    Requires completing onboarding in the app at least once to set up your
    interest profile (categories + keywords stored in the local SQLite DB).

    Args:
        user_id: Local user ID (default 1 for single-user setups).
        limit: Max notifications to return (default 50, max 200).
        unread_only: If True, return only unread notifications.

    Returns:
        Dict with:
          - "total": total matching notifications in database
          - "notifications": list of paper alerts, each with title, topic,
            citation_count, source_url, is_read, and created_at
    """
    db = SessionLocal()
    try:
        query = db.query(Notification).filter(Notification.user_id == user_id)
        if unread_only:
            query = query.filter(Notification.is_read == False)  # noqa: E712
        notifications = (
            query.order_by(Notification.created_at.desc())
            .limit(min(limit, 200))
            .all()
        )

        return {
            "total": len(notifications),
            "notifications": [
                {
                    "id": n.id,
                    "title": n.title,
                    "topic": n.topic,
                    "citation_count": n.citation_count or 0,
                    "source_url": n.source_url,
                    "is_read": n.is_read,
                    "created_at": n.created_at.isoformat() if n.created_at else None,
                }
                for n in notifications
            ],
        }
    finally:
        db.close()


if __name__ == "__main__":
    mcp.run()

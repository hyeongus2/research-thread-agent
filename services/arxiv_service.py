import time
from datetime import date
from typing import Optional

import arxiv

from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)


def search_papers(
    keyword: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    max_results: int = 20,
) -> list[dict]:
    """Search arXiv for papers matching keyword within an optional date range.

    Uses submittedDate filter when dates are provided.
    Sleeps 0.34s between results to stay within the 3 req/sec arXiv limit.

    Args:
        keyword: Search query string.
        start_date: Inclusive lower bound for submission date.
        end_date: Inclusive upper bound for submission date.
        max_results: Maximum number of papers to return.

    Returns:
        List of paper dicts with keys: title, authors, abstract, url,
        pdf_url, published_date, categories.
    """
    query = keyword
    if start_date and end_date:
        start_str = start_date.strftime("%Y%m%d")
        end_str = end_date.strftime("%Y%m%d")
        query = f"{keyword} AND submittedDate:[{start_str}0000 TO {end_str}2359]"

    client = arxiv.Client()
    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.SubmittedDate,
        sort_order=arxiv.SortOrder.Descending,
    )

    papers = []
    for result in client.results(search):
        papers.append({
            "title": result.title,
            "authors": [a.name for a in result.authors],
            "abstract": result.summary,
            "url": result.entry_id,
            "pdf_url": result.pdf_url,
            "published_date": result.published.date() if result.published else None,
            "categories": result.categories,
        })
        time.sleep(settings.ARXIV_RATE_LIMIT_DELAY)

    logger.info("arXiv search '%s' returned %d papers", keyword, len(papers))
    return papers


def search_papers_by_topic_all_years(
    topic: str,
    max_results: int = 100,
) -> list[dict]:
    """Fetch all available papers for a topic without date filtering.

    Used by historical_thread_service to build era-grouped Learning Paths.
    """
    return search_papers(topic, max_results=max_results)

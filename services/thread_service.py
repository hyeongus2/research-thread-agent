"""Orchestrates the Quick Search flow: fetch → score → summarize."""

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError, as_completed
from datetime import date, datetime
from typing import Callable, Optional

from sqlalchemy.orm import Session

from config.settings import settings
from services import arxiv_service, claude_service, github_service, hf_service
from services.database_service import save_search_history
from utils.logger import get_logger

logger = get_logger(__name__)


def _to_str(v):
    """Convert date/datetime to ISO string; leave everything else unchanged."""
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v


def _serialize(items: list[dict]) -> list[dict]:
    """Make all date/datetime values in each item JSON-serializable."""
    return [
        {
            k: ([_to_str(x) for x in v] if isinstance(v, list) else _to_str(v))
            for k, v in item.items()
        }
        for item in items
    ]


def create_research_thread(
    keyword: str,
    start_date: Optional[date],
    end_date: Optional[date],
    info_types: list[str],
    user_id: int,
    db: Session,
    on_progress: Optional[Callable[[str, str], None]] = None,
) -> dict:
    """Fetch, rank, and summarize research content for a keyword.

    Calls arXiv / HF / GitHub concurrently, scores relevance with Claude,
    generates a topic overview, saves to search history, and returns a Thread dict.

    Args:
        keyword: User search query.
        start_date: Inclusive lower bound for content date (None = no filter).
        end_date: Inclusive upper bound (None = no filter).
        info_types: Subset of ["paper", "model", "repo"] to include.
        user_id: ID of the requesting user (for search history).
        db: SQLAlchemy session.

    Returns:
        Thread dict with keys: keyword, overview, papers, models, repos, generated_at.
    """
    def _progress(stage: str, msg: str) -> None:
        if on_progress:
            on_progress(stage, msg)

    papers: list[dict] = []
    models: list[dict] = []
    repos: list[dict] = []

    _progress("fetching_sources", "Searching arXiv · Hugging Face · GitHub simultaneously…")

    # Concurrent fetch from all enabled sources; cap total wait at 30 s per source
    executor = ThreadPoolExecutor(max_workers=3)
    try:
        futures: dict = {}
        if "paper" in info_types:
            futures[executor.submit(
                arxiv_service.search_papers, keyword, start_date, end_date, 15
            )] = "papers"
        if "model" in info_types:
            futures[executor.submit(
                hf_service.search_models, keyword, start_date, 8
            )] = "models"
        if "repo" in info_types:
            futures[executor.submit(
                github_service.search_repositories, keyword, start_date, end_date, 8
            )] = "repos"

        processed: set = set()
        try:
            for future in as_completed(futures, timeout=30):
                processed.add(future)
                key = futures[future]
                try:
                    result = future.result()
                    if key == "papers":
                        papers = result
                    elif key == "models":
                        models = result
                    elif key == "repos":
                        repos = result
                    _progress("source_done", f"{key}:{len(result)}")
                except Exception as exc:
                    logger.warning("Fetch failed for %s: %s", key, exc)
                    _progress("source_done", f"{key}:-1")
        except FutureTimeoutError:
            logger.warning("Source fetch timed out after 30 s; proceeding with partial results")
            for future, key in futures.items():
                if future not in processed:
                    future.cancel()
                    _progress("source_done", f"{key}:-1")
    finally:
        executor.shutdown(wait=False)

    _progress("scoring", "Running AI relevance scoring…")

    # Score relevance with Claude and keep top results
    if papers:
        papers = claude_service.score_relevance(keyword, papers)
        papers.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        papers = papers[:10]

    if models:
        for m in models:
            m["title"] = m["name"]
            tags_str = ", ".join(m.get("tags", [])[:6]) if m.get("tags") else "none"
            m["abstract"] = (
                f"HuggingFace model '{m['name']}'. "
                f"Pipeline: {m.get('pipeline_tag') or 'general'}. "
                f"Tags: {tags_str}. "
                f"Downloads: {m.get('downloads', 0):,}."
            )
        models = claude_service.score_relevance(keyword, models)
        models.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        models = models[:5]

    if repos:
        for r in repos:
            r["title"] = r["name"]
            r["abstract"] = r.get("description") or f"GitHub repository: {r['name']}."
        repos = claude_service.score_relevance(keyword, repos)
        repos.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        repos = repos[:5]

    _progress("overview", "Generating topic overview…")

    overview = claude_service.generate_overview(keyword, papers)

    thread = {
        "keyword": keyword,
        "overview": overview,
        "has_ai": bool(settings.ANTHROPIC_API_KEY),
        "papers": _serialize(papers),
        "models": _serialize(models),
        "repos": _serialize(repos),
        "generated_at": datetime.utcnow().isoformat(),
    }

    try:
        save_search_history(
            db,
            user_id=user_id,
            keyword=keyword,
            thread_results=thread,
            date_range_start=start_date.isoformat() if start_date else None,
            date_range_end=end_date.isoformat() if end_date else None,
            info_types=info_types,
        )
    except Exception as exc:
        logger.warning("Failed to save search history: %s", exc)

    return thread

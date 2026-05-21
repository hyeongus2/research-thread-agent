"""Orchestrates the Quick Search flow: concurrent fetch → return sorted results."""

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError, as_completed
from datetime import date, datetime
from typing import Callable, Optional

from sqlalchemy.orm import Session

from services import github_service, hf_service, semantic_scholar_service
from services.database_service import save_search_history
from utils.logger import get_logger

logger = get_logger(__name__)


def _classify_error(exc: Exception) -> tuple[str, int]:
    """Return (error_kind, retry_seconds) for a fetch exception."""
    msg = str(exc)
    if "429" in msg or "rate limit" in msg.lower() or "too many" in msg.lower():
        return "rate_limit", 600
    if "401" in msg or "bad credentials" in msg.lower() or "authentication" in msg.lower():
        return "auth_error", 0
    if "timeout" in msg.lower() or "timed out" in msg.lower():
        return "timeout", 0
    return "error", 0


def _to_str(v):
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return v


def _serialize(items: list[dict]) -> list[dict]:
    return [
        {k: ([_to_str(x) for x in v] if isinstance(v, list) else _to_str(v)) for k, v in item.items()}
        for item in items
    ]


def create_research_thread(
    keyword: str,
    start_date: Optional[date],
    end_date: Optional[date],
    user_id: int,
    db: Session,
    on_progress: Optional[Callable[[str, str], None]] = None,
    paper_limit: int = 50,
    model_limit: int = 25,
    repo_limit: int = 25,
) -> dict:
    """Fetch papers, models, and repos concurrently for a keyword.

    Papers from Semantic Scholar (sorted by citation count), models from HF Hub
    (sorted by downloads), repos from GitHub (sorted by stars). No LLM scoring.

    Args:
        keyword: User search query.
        start_date: Inclusive lower bound for content date.
        end_date: Inclusive upper bound.
        user_id: ID of the requesting user (for search history).
        db: SQLAlchemy session.
        on_progress: Optional SSE callback (stage, msg).

    Returns:
        Thread dict: keyword, papers, models, repos, generated_at.
    """
    def _progress(stage: str, msg: str) -> None:
        if on_progress:
            on_progress(stage, msg)

    papers: list[dict] = []
    models: list[dict] = []
    repos: list[dict] = []

    _progress("fetching_sources", "Searching Semantic Scholar · Hugging Face · GitHub simultaneously…")

    executor = ThreadPoolExecutor(max_workers=3)
    try:
        futures = {
            executor.submit(
                semantic_scholar_service.search_papers, keyword, start_date, end_date, paper_limit
            ): "papers",
            executor.submit(hf_service.search_models, keyword, start_date, model_limit): "models",
            executor.submit(
                github_service.search_repositories, keyword, start_date, end_date, repo_limit
            ): "repos",
        }
        processed: set = set()
        try:
            for future in as_completed(futures, timeout=60):
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
                    kind, retry_secs = _classify_error(exc)
                    logger.warning("Fetch failed for %s: %s", key, exc)
                    _progress("source_done", f"{key}:-1:{kind}:{retry_secs}")
        except FutureTimeoutError:
            logger.warning("Source fetch timed out after 60 s; proceeding with partial results")
            for future, key in futures.items():
                if future not in processed:
                    future.cancel()
                    _progress("source_done", f"{key}:-1:timeout:0")
    finally:
        executor.shutdown(wait=False)

    thread = {
        "keyword": keyword,
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
            info_types=["paper", "model", "repo"],
        )
    except Exception as exc:
        logger.warning("Failed to save search history: %s", exc)

    return thread

from datetime import date
from typing import Optional

from huggingface_hub import HfApi

from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)


def _get_api() -> HfApi:
    return HfApi(token=settings.HF_API_TOKEN or None)


def _has_topic_signal(model_id: str, keyword: str, tags: list) -> bool:
    """Return True if any keyword term appears in the model's repo name or tags."""
    terms = keyword.lower().split()
    repo_part = model_id.split("/")[-1].lower()
    tags_str = " ".join((t or "").lower() for t in (tags or []))
    return any(term in repo_part or term in tags_str for term in terms)


def search_models(
    keyword: str,
    start_date: Optional[date] = None,
    max_results: int = 10,
) -> list[dict]:
    """Search Hugging Face Hub for models matching keyword, sorted by downloads.

    Fetches a larger candidate set, then prioritises models where the keyword
    appears in the repo name or tags (not only in the username), so that results
    like 'xxragxx/unrelated-model' are deprioritised.

    Args:
        keyword: Search query string.
        start_date: Skip models last modified before this date (best-effort filter).
        max_results: Maximum number of models to return.

    Returns:
        List of model dicts with keys: name, downloads, likes, url,
        pipeline_tag, tags, last_modified.
    """
    api = _get_api()
    with_signal: list[dict] = []
    without_signal: list[dict] = []

    for model in api.list_models(
        search=keyword,
        sort="downloads",
        limit=max_results * 5,
    ):
        last_modified = getattr(model, "lastModified", None) or getattr(
            model, "last_modified", None
        )
        if start_date and last_modified:
            model_date = last_modified.date() if hasattr(last_modified, "date") else None
            if model_date and model_date < start_date:
                continue

        tags = list(getattr(model, "tags", None) or [])
        entry = {
            "name": model.id,
            "downloads": getattr(model, "downloads", 0) or 0,
            "likes": getattr(model, "likes", 0) or 0,
            "url": f"https://huggingface.co/{model.id}",
            "pipeline_tag": getattr(model, "pipeline_tag", None),
            "tags": tags[:12],
            "last_modified": last_modified,
        }
        if _has_topic_signal(model.id, keyword, tags):
            with_signal.append(entry)
        else:
            without_signal.append(entry)

        if len(with_signal) + len(without_signal) >= max_results * 5:
            break

    ordered = (with_signal + without_signal)[:max_results]
    logger.info("HF model search '%s' returned %d results (%d with topic signal)",
                keyword, len(ordered), len(with_signal))
    return ordered


def search_datasets(
    keyword: str,
    max_results: int = 5,
) -> list[dict]:
    """Search Hugging Face Hub for datasets matching keyword.

    Args:
        keyword: Search query string.
        max_results: Maximum number of datasets to return.

    Returns:
        List of dataset dicts with keys: name, downloads, url, last_modified.
    """
    api = _get_api()
    datasets = []

    for dataset in api.list_datasets(
        search=keyword,
        sort="downloads",
        limit=max_results,
    ):
        datasets.append({
            "name": dataset.id,
            "downloads": getattr(dataset, "downloads", 0) or 0,
            "url": f"https://huggingface.co/datasets/{dataset.id}",
            "last_modified": getattr(dataset, "lastModified", None),
        })

    logger.info("HF dataset search '%s' returned %d results", keyword, len(datasets))
    return datasets

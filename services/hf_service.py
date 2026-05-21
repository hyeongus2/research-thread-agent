from datetime import date
from typing import Optional

from huggingface_hub import HfApi

from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)


def _get_api() -> HfApi:
    return HfApi(token=settings.HF_API_TOKEN or None)


def search_models(
    keyword: str,
    start_date: Optional[date] = None,
    max_results: int = 10,
) -> list[dict]:
    """Search Hugging Face Hub for models matching keyword, sorted by downloads.

    Args:
        keyword: Search query string.
        start_date: Skip models last modified before this date (best-effort filter).
        max_results: Maximum number of models to return.

    Returns:
        List of model dicts with keys: name, downloads, likes, url,
        pipeline_tag, last_modified.
    """
    api = _get_api()
    models = []

    for model in api.list_models(
        search=keyword,
        sort="downloads",
        limit=max_results * 2,  # fetch extra to allow date filtering
    ):
        last_modified = getattr(model, "lastModified", None) or getattr(
            model, "last_modified", None
        )
        if start_date and last_modified:
            model_date = last_modified.date() if hasattr(last_modified, "date") else None
            if model_date and model_date < start_date:
                continue

        models.append({
            "name": model.id,
            "downloads": getattr(model, "downloads", 0) or 0,
            "likes": getattr(model, "likes", 0) or 0,
            "url": f"https://huggingface.co/{model.id}",
            "pipeline_tag": getattr(model, "pipeline_tag", None),
            "last_modified": last_modified,
        })

        if len(models) >= max_results:
            break

    logger.info("HF model search '%s' returned %d results", keyword, len(models))
    return models


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

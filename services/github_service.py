from datetime import date
from typing import Optional

from github import Github, GithubException

from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)


def _get_client() -> Github:
    if not settings.GITHUB_TOKEN:
        raise ValueError(
            "GITHUB_TOKEN is required. Unauthenticated requests are limited to 60/hour."
        )
    return Github(settings.GITHUB_TOKEN)


def search_repositories(
    keyword: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    max_results: int = 10,
) -> list[dict]:
    """Search GitHub for repositories matching keyword, sorted by stars.

    Date filters map to the GitHub 'created' qualifier.
    GitHub API allows 5000 requests/hour with a valid token.

    Args:
        keyword: Search query string.
        start_date: Include repos created on or after this date.
        end_date: Include repos created on or before this date.
        max_results: Maximum number of repositories to return.

    Returns:
        List of repo dicts with keys: name, description, stars, url,
        language, created_at, updated_at, topics.
    """
    g = _get_client()

    query = keyword
    if start_date:
        query += f" pushed:>={start_date.isoformat()}"
    if end_date:
        query += f" pushed:<={end_date.isoformat()}"

    repos = []
    try:
        results = g.search_repositories(query=query, sort="stars", order="desc")
        for repo in results[:max_results]:
            repos.append({
                "name": repo.full_name,
                "description": repo.description or "",
                "stars": repo.stargazers_count,
                "url": repo.html_url,
                "language": repo.language,
                "created_at": repo.created_at.date() if repo.created_at else None,
                "updated_at": repo.updated_at.date() if repo.updated_at else None,
                "topics": repo.get_topics(),
            })
    except GithubException as e:
        if e.status == 403:
            raise RuntimeError("GitHub API rate limit exceeded") from e
        raise

    logger.info("GitHub search '%s' returned %d repos", keyword, len(repos))
    return repos

"""Historical thread service for building era-grouped Learning Paths."""

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from services import semantic_scholar_service, claude_service, database_service, github_service, hf_service
from utils.logger import get_logger

logger = get_logger(__name__)


def _era_buckets() -> list[tuple]:
    """Return ordered list of (start_year_or_None, end_year, label) tuples.

    Fixed early eras: Before 2018 / 2018–2020 / 2021–2022.
    From 2023 onward: 2-year buckets (2023–2024, 2025–2026, …).
    If the current year is odd, the final bucket contains only that single year.
    """
    current = datetime.utcnow().year
    buckets = [
        (None, 2017, "Before 2018"),
        (2018, 2020, "2018–2020"),
        (2021, 2022, "2021–2022"),
    ]
    year = 2023
    while year <= current:
        end = year + 1
        if end <= current:
            buckets.append((year, end, f"{year}–{end}"))
            year += 2
        else:
            # Current year is odd — single-year final bucket
            buckets.append((year, year, str(year)))
            break
    return buckets


def group_papers_by_era(papers: list[dict]) -> dict[str, list[dict]]:
    """Group papers into chronological era buckets.

    Buckets: Before 2018 / 2018–2020 / 2021–2022 / 2023–2024 / 2025–2026 / …
    From 2023 onward groups are 2-year pairs; if the current year is odd, the
    final bucket contains only that single year.

    Args:
        papers: List of paper dicts; each must have a 'published_date' field.

    Returns:
        Dict keyed by era label → list of papers (most recent first, capped at
        10 per era). Empty eras are omitted.
    """
    buckets = _era_buckets()
    groups: dict[str, list] = {label: [] for _, _, label in buckets}

    for paper in papers:
        pub = paper.get("published_date")
        if pub is None:
            continue
        if hasattr(pub, "year"):
            year = pub.year
        else:
            try:
                year = int(str(pub)[:4])
            except (ValueError, TypeError):
                continue

        for start, end, label in buckets:
            if start is None:
                if year <= end:
                    groups[label].append(paper)
                    break
            else:
                if start <= year <= end:
                    groups[label].append(paper)
                    break

    for label in list(groups.keys()):
        groups[label].sort(
            key=lambda p: str(p.get("published_date") or ""),
            reverse=True,
        )
        groups[label] = groups[label][:10]

    return {label: papers for label, papers in groups.items() if papers}


def _serialize_paper(paper: dict) -> dict:
    """Convert date objects to strings so the dict is JSON-serializable."""
    result = dict(paper)
    pub = result.get("published_date")
    if pub is not None and not isinstance(pub, str):
        result["published_date"] = str(pub)
    return result


def build_learning_path(topic: str, db: Session) -> dict:
    """Build or retrieve a cached era-grouped Learning Path for a topic.

    Checks the historical_threads cache first (7-day TTL). On a miss, fetches
    papers from arXiv, groups them by era, calls Claude for per-era summaries,
    and fetches HF models + GitHub repos for context.

    Args:
        topic: Research topic string.
        db: SQLAlchemy session.

    Returns:
        LearningPath dict: {topic, description, eras, generated_at}.
    """
    cached = database_service.get_cached_historical_thread(db, topic)
    if cached:
        logger.info("Learning path cache hit for topic '%s'", topic)
        return cached

    logger.info("Building learning path for topic '%s'", topic)
    papers = semantic_scholar_service.search_papers(topic, limit=100)
    era_groups = group_papers_by_era(papers)

    # Fetch shared HF and GitHub results once (topic-level, not per-era)
    try:
        shared_models = hf_service.search_models(topic, max_results=5)
        models_payload = [
            {
                "name": m["name"],
                "url": m["url"],
                "pipeline_tag": m.get("pipeline_tag"),
                "downloads": m.get("downloads", 0),
            }
            for m in shared_models
        ]
    except Exception as exc:
        logger.warning("HF model search failed for learning path: %s", exc)
        models_payload = []

    try:
        shared_repos = github_service.search_repositories(topic, max_results=5)
        repos_payload = [
            {
                "name": r["name"],
                "url": r["url"],
                "stars": r.get("stars", 0),
                "description": r.get("description", ""),
            }
            for r in shared_repos
        ]
    except Exception as exc:
        logger.warning("GitHub search failed for learning path: %s", exc)
        repos_payload = []

    eras = []
    for label, era_papers in era_groups.items():
        serialized = [_serialize_paper(p) for p in era_papers]
        summary = claude_service.generate_era_summary(topic, label, serialized)
        eras.append(
            {
                "label": label,
                "summary": summary or "",
                "papers": serialized,
                "models": models_payload,
                "repos": repos_payload,
            }
        )

    all_years = sorted(
        {
            str(p.get("published_date") or "")[:4]
            for era in eras
            for p in era.get("papers", [])
            if p.get("published_date")
        }
    )
    year_range = (
        f"{all_years[0]}–{all_years[-1]}"
        if len(all_years) >= 2
        else (all_years[0] if all_years else "")
    )

    description = claude_service.generate_overview(topic, papers[:8])

    result = {
        "topic": topic,
        "description": description or "",
        "eras": eras,
        "generated_at": datetime.utcnow().isoformat(),
    }

    database_service.save_historical_thread(db, topic, result, year_range)
    return result

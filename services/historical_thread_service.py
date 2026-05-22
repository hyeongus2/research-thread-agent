"""Historical thread service for building era-grouped Learning Paths."""

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, date as _date
from typing import Generator, Optional

from sqlalchemy.orm import Session

from config.settings import settings
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
            buckets.append((year, year, str(year)))
            break
    return buckets


def _fetch_papers_per_era(
    topic: str,
    papers_per_era: int,
    _source_out: Optional[list] = None,
) -> dict[str, list[dict]]:
    """Fetch papers for each era using separate date-filtered queries (parallel).

    Each era gets its own Semantic Scholar request with start/end date bounds,
    so recent eras receive papers ranked by citation count *within that window*
    rather than being starved by all-time citation leaders.

    Args:
        topic: Research topic keyword(s).
        papers_per_era: Maximum papers to fetch per era.
        _source_out: Optional single-element list; populated with the source
            label ("Semantic Scholar" or "OpenAlex") from the first completed era.

    Returns:
        Ordered dict mapping era label → list of paper dicts (non-empty eras only).
    """
    buckets = _era_buckets()
    source_recorded = False

    def _fetch_one(start_year, end_year, label):
        start = _date(start_year, 1, 1) if start_year is not None else None
        end = _date(end_year, 12, 31)
        src: list = []
        try:
            papers = semantic_scholar_service.search_papers(topic, start, end, papers_per_era, src)
        except Exception as exc:
            logger.warning("Era '%s' fetch failed: %s", label, exc)
            papers = []
        return label, papers, src

    era_results: dict[str, list] = {}

    with ThreadPoolExecutor(max_workers=min(len(buckets), 8)) as executor:
        future_map = {
            executor.submit(_fetch_one, start, end, label): label
            for start, end, label in buckets
        }
        for future in as_completed(future_map):
            label, papers, src = future.result()
            if papers:
                era_results[label] = papers
            if _source_out is not None and src and not source_recorded:
                _source_out.extend(src)
                source_recorded = True

    # Restore insertion order (buckets order) for era_results
    ordered = {}
    for _, _, label in buckets:
        if label in era_results:
            ordered[label] = era_results[label]
    return ordered


def _serialize_paper(paper: dict) -> dict:
    """Convert date objects to strings so the dict is JSON-serializable."""
    result = dict(paper)
    pub = result.get("published_date")
    if pub is not None and not isinstance(pub, str):
        result["published_date"] = str(pub)
    return result


def _build_result(
    topic: str,
    era_groups: dict,
    models_payload: list,
    repos_payload: list,
    models_error: bool,
    repos_error: bool,
    lang: str,
) -> tuple[dict, str]:
    """Shared result assembly: call Claude per era and compose the final dict."""
    ai_key_missing = not settings.ANTHROPIC_API_KEY
    eras = []

    for label, era_papers in era_groups.items():
        serialized = [_serialize_paper(p) for p in era_papers]

        analysis = claude_service.generate_era_analysis(topic, label, serialized, lang=lang)

        era_summary = ""
        ai_status = "no_key" if ai_key_missing else "ok"

        if analysis:
            era_summary = analysis.get("summary", "")
            paper_analyses = {p.get("index", 0): p for p in analysis.get("papers", [])}
            for i, paper in enumerate(serialized, 1):
                pa = paper_analyses.get(i, {})
                paper["problem"] = pa.get("problem", "")
                paper["solution"] = pa.get("solution", "")
                paper["significance"] = pa.get("significance", "")
                paper["limitations"] = pa.get("limitations", "")
        elif not ai_key_missing:
            ai_status = "error"

        eras.append({
            "label": label,
            "summary": era_summary,
            "ai_status": ai_status,
            "papers": serialized,
            "models": models_payload,
            "repos": repos_payload,
        })

    all_years = sorted({
        str(p.get("published_date") or "")[:4]
        for era in eras
        for p in era.get("papers", [])
        if p.get("published_date")
    })
    year_range = (
        f"{all_years[0]}–{all_years[-1]}" if len(all_years) >= 2
        else (all_years[0] if all_years else "")
    )

    overview_papers = [p for era in eras for p in era.get("papers", [])][:10]
    description = claude_service.generate_overview(topic, overview_papers, lang=lang)

    return {
        "topic": topic,
        "description": description or "",
        "ai_key_missing": ai_key_missing,
        "models_error": models_error,
        "repos_error": repos_error,
        "eras": eras,
        "generated_at": datetime.utcnow().isoformat(),
    }, year_range


def build_learning_path(
    topic: str,
    db: Session,
    lang: str = "en",
    papers_per_era: int = 10,
    models_count: int = 5,
    repos_count: int = 5,
) -> dict:
    """Build or retrieve a cached era-grouped Learning Path for a topic."""
    cached = database_service.get_cached_historical_thread(db, topic)
    if cached:
        logger.info("Learning path cache hit for topic '%s'", topic)
        return cached

    logger.info("Building learning path for topic '%s'", topic)
    era_groups = _fetch_papers_per_era(topic, papers_per_era)

    models_payload, models_error = _fetch_models(topic, models_count)
    repos_payload, repos_error = _fetch_repos(topic, repos_count)

    result, year_range = _build_result(
        topic, era_groups,
        models_payload, repos_payload,
        models_error, repos_error, lang,
    )
    database_service.save_historical_thread(db, topic, result, year_range)
    return result


def _fetch_models(topic: str, max_results: int = 5) -> tuple[list, bool]:
    try:
        shared = hf_service.search_models(topic, max_results=max_results)
        return [
            {"name": m["name"], "url": m["url"],
             "pipeline_tag": m.get("pipeline_tag"), "downloads": m.get("downloads", 0)}
            for m in shared
        ], False
    except Exception as exc:
        logger.warning("HF model search failed for learning path: %s", exc)
        return [], True


def _fetch_repos(topic: str, max_results: int = 5) -> tuple[list, bool]:
    try:
        shared = github_service.search_repositories(topic, max_results=max_results)
        return [
            {"name": r["name"], "url": r["url"],
             "stars": r.get("stars", 0), "description": r.get("description", ""),
             "language": r.get("language") or ""}
            for r in shared
        ], False
    except Exception as exc:
        logger.warning("GitHub search failed for learning path: %s", exc)
        return [], True


def build_learning_path_stream(
    topic: str,
    db: Session,
    lang: str = "en",
    papers_per_era: int = 10,
    models_count: int = 5,
    repos_count: int = 5,
) -> Generator[dict, None, None]:
    """Generator that yields SSE-ready progress dicts while building a Learning Path.

    Each yielded dict has a 'type' key. The final event is
    {'type': 'done', 'result': <full learning path dict>}.
    """
    cached = database_service.get_cached_historical_thread(db, topic)
    if cached:
        logger.info("Learning path cache hit for topic '%s'", topic)
        yield {"type": "cache_hit"}
        yield {"type": "done", "result": cached}
        return

    logger.info("Building learning path (stream) for topic '%s'", topic)

    # ── Concurrent fetch: papers-per-era + models + repos ─────────────────────
    yield {"type": "fetching_sources"}

    papers_source_out: list = []
    era_groups: dict = {}

    with ThreadPoolExecutor(max_workers=3) as executor:
        era_future    = executor.submit(_fetch_papers_per_era, topic, papers_per_era, papers_source_out)
        models_future = executor.submit(_fetch_models, topic, models_count)
        repos_future  = executor.submit(_fetch_repos, topic, repos_count)

        era_groups = era_future.result()
        actual_source = papers_source_out[0] if papers_source_out else "Semantic Scholar"
        total_papers = sum(len(v) for v in era_groups.values())
        yield {"type": "papers_done", "total": total_papers, "source": actual_source}
        for label, era_papers in era_groups.items():
            yield {"type": "era_found", "label": label, "count": len(era_papers)}

        models_payload, models_error = models_future.result()
        if models_error:
            yield {"type": "models_error"}
        else:
            yield {"type": "models_done", "count": len(models_payload)}

        repos_payload, repos_error = repos_future.result()
        if repos_error:
            yield {"type": "repos_error"}
        else:
            yield {"type": "repos_done", "count": len(repos_payload)}

    # ── Per-era Claude analysis ─────────────────────────────────────────────────
    ai_key_missing = not settings.ANTHROPIC_API_KEY
    eras = []

    for label, era_papers in era_groups.items():
        serialized = [_serialize_paper(p) for p in era_papers]
        yield {"type": "analyzing_era", "label": label}

        analysis = claude_service.generate_era_analysis(topic, label, serialized, lang=lang)

        era_summary = ""
        ai_status = "no_key" if ai_key_missing else "ok"
        if analysis:
            era_summary = analysis.get("summary", "")
            paper_analyses = {p.get("index", 0): p for p in analysis.get("papers", [])}
            for i, paper in enumerate(serialized, 1):
                pa = paper_analyses.get(i, {})
                paper["problem"] = pa.get("problem", "")
                paper["solution"] = pa.get("solution", "")
                paper["significance"] = pa.get("significance", "")
                paper["limitations"] = pa.get("limitations", "")
        elif not ai_key_missing:
            ai_status = "error"

        eras.append({
            "label": label,
            "summary": era_summary,
            "ai_status": ai_status,
            "papers": serialized,
            "models": models_payload,
            "repos": repos_payload,
        })
        yield {"type": "era_analyzed", "label": label}

    # ── Overview ────────────────────────────────────────────────────────────────
    overview_papers = [p for era in eras for p in era.get("papers", [])][:10]
    description = claude_service.generate_overview(topic, overview_papers, lang=lang)

    all_years = sorted({
        str(p.get("published_date") or "")[:4]
        for era in eras
        for p in era.get("papers", [])
        if p.get("published_date")
    })
    year_range = (
        f"{all_years[0]}–{all_years[-1]}" if len(all_years) >= 2
        else (all_years[0] if all_years else "")
    )

    result = {
        "topic": topic,
        "description": description or "",
        "ai_key_missing": ai_key_missing,
        "models_error": models_error,
        "repos_error": repos_error,
        "eras": eras,
        "generated_at": datetime.utcnow().isoformat(),
    }

    database_service.save_historical_thread(db, topic, result, year_range)
    yield {"type": "done", "result": result}

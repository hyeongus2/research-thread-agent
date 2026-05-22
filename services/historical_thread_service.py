"""Historical thread service for building era-grouped Learning Paths."""

from concurrent.futures import ThreadPoolExecutor
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


def group_papers_by_era(papers: list[dict], papers_per_era: int = 10) -> dict[str, list[dict]]:
    """Group papers into chronological era buckets (max papers_per_era per era)."""
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
        groups[label] = groups[label][:papers_per_era]

    return {label: papers for label, papers in groups.items() if papers}


def _fetch_papers_with_recent_boost(
    topic: str,
    papers_total: int,
    _source_out: Optional[list] = None,
) -> list[dict]:
    """Fetch citation-sorted papers, then supplement with recent papers.

    Semantic Scholar sorts by citation count, so recent (< 2 years old) papers
    rarely make it into the top N results even if they are relevant. This helper
    makes a second targeted request for recent papers and merges them in so that
    the most recent era is always populated.
    """
    papers = semantic_scholar_service.search_papers(topic, None, None, papers_total, _source_out)

    current_year = datetime.utcnow().year
    recent_start = _date(current_year - 1, 1, 1)
    try:
        recent = semantic_scholar_service.search_papers(topic, recent_start, None, 30)
        seen_titles = {p["title"].lower() for p in papers}
        papers += [p for p in recent if p["title"].lower() not in seen_titles]
    except Exception:
        pass

    return papers


def _serialize_paper(paper: dict) -> dict:
    """Convert date objects to strings so the dict is JSON-serializable."""
    result = dict(paper)
    pub = result.get("published_date")
    if pub is not None and not isinstance(pub, str):
        result["published_date"] = str(pub)
    return result


def _build_result(
    topic: str,
    papers: list[dict],
    era_groups: dict,
    models_payload: list,
    repos_payload: list,
    models_error: bool,
    repos_error: bool,
    lang: str,
) -> dict:
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

    description = claude_service.generate_overview(topic, papers[:10], lang=lang)

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
    papers_total: int = 100,
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
    papers = _fetch_papers_with_recent_boost(topic, papers_total)
    era_groups = group_papers_by_era(papers, papers_per_era)

    models_payload, models_error = _fetch_models(topic, models_count)
    repos_payload, repos_error = _fetch_repos(topic, repos_count)

    result, year_range = _build_result(
        topic, papers, era_groups,
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
    papers_total: int = 100,
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

    # ── Concurrent fetch: papers + models + repos ──────────────────────────────
    yield {"type": "fetching_sources"}

    with ThreadPoolExecutor(max_workers=3) as executor:
        papers_source_out: list = []
        papers_future = executor.submit(
            _fetch_papers_with_recent_boost, topic, papers_total, papers_source_out
        )
        models_future = executor.submit(_fetch_models, topic, models_count)
        repos_future  = executor.submit(_fetch_repos, topic, repos_count)

        papers = papers_future.result()
        actual_source = papers_source_out[0] if papers_source_out else "Semantic Scholar"
        era_groups = group_papers_by_era(papers, papers_per_era)
        yield {"type": "papers_done", "total": len(papers), "source": actual_source}
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
    description = claude_service.generate_overview(topic, papers[:10], lang=lang)

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

"""Check user subscriptions and create Notification records for new papers."""

import json
import logging
import time
from datetime import date, timedelta
from typing import Callable, Optional

from sqlalchemy.orm import Session

from models.notification import Notification
from models.user import User
from services import semantic_scholar_service

logger = logging.getLogger(__name__)

_FETCH_WINDOW_DAYS = 30
_DELAY_BETWEEN_QUERIES = 2.0  # seconds — avoids Semantic Scholar 429
_PAPERS_PER_QUERY = 10

CATEGORY_QUERIES = {
    "NLP/LLM":                "large language model NLP",
    "Computer Vision":        "computer vision image recognition",
    "Generative AI":          "generative AI diffusion",
    "AI Agents":              "LLM agent tool use",
    "Reinforcement Learning": "reinforcement learning",
    "Multimodal":             "multimodal vision language",
    "Speech/Audio":           "speech audio recognition",
    "Robotics":               "robotics manipulation",
    "ML Theory":              "machine learning theory optimization",
    "Systems/Efficiency":     "model efficiency quantization",
}


def _check_user(db: Session, user: User, progress_cb: Optional[Callable] = None) -> int:
    """Fetch new papers for one user; insert Notification rows. Returns new count."""
    try:
        prefs = json.loads(user.preferences) if user.preferences else {}
    except (json.JSONDecodeError, TypeError):
        prefs = {}

    queries: list[tuple[str, str]] = []  # (display_label, search_query)
    for cat in prefs.get("categories", []):
        q = CATEGORY_QUERIES.get(cat)
        if q:
            queries.append((cat, q))
    for kw in prefs.get("keywords", []):
        if kw:
            queries.append((kw, kw))

    if not queries:
        if progress_cb:
            progress_cb({"stage": "done", "total_new": 0})
        return 0

    if progress_cb:
        progress_cb({"stage": "start", "total": len(queries)})

    seen_urls = {
        n.source_url
        for n in db.query(Notification).filter(Notification.user_id == user.id).all()
        if n.source_url
    }

    since = date.today() - timedelta(days=_FETCH_WINDOW_DAYS)
    total_new = 0

    for i, (label, query) in enumerate(queries):
        if i > 0:
            time.sleep(_DELAY_BETWEEN_QUERIES)

        if progress_cb:
            progress_cb({"stage": "fetching", "label": label, "index": i + 1, "total": len(queries)})

        try:
            papers = semantic_scholar_service.search_papers(
                query, start_date=since, limit=_PAPERS_PER_QUERY
            )
        except Exception as exc:
            logger.warning("notification fetch failed for '%s': %s", query, exc)
            if progress_cb:
                progress_cb({
                    "stage": "fetched", "label": label, "index": i + 1,
                    "total": len(queries), "found": 0, "new": 0, "error": True,
                })
            continue

        new_count = 0
        for p in papers:
            url = p.get("url") or p.get("pdf_url")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            new_count += 1
            db.add(Notification(
                user_id=user.id,
                title=p.get("title", ""),
                content=p.get("abstract") or "",
                info_type="paper",
                topic=label,
                source_url=url,
                citation_count=p.get("citation_count") or 0,
            ))

        total_new += new_count
        if progress_cb:
            progress_cb({
                "stage": "fetched", "label": label, "index": i + 1,
                "total": len(queries), "found": len(papers), "new": new_count,
            })

    db.commit()
    if progress_cb:
        progress_cb({"stage": "done", "total_new": total_new})
    logger.info("Notifications generated for user %d: %d new", user.id, total_new)
    return total_new


def check_and_notify(db: Session) -> None:
    """Fetch new papers for all users' subscriptions (used by scheduler)."""
    users = db.query(User).all()
    for user in users:
        try:
            _check_user(db, user)
        except Exception as exc:
            logger.error("check_and_notify failed for user %d: %s", user.id, exc)


def check_and_notify_for_user(
    db: Session, user_id: int, progress_cb: Optional[Callable] = None
) -> int:
    """Fetch new papers for a single user by ID. Returns new notification count."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        if progress_cb:
            progress_cb({"stage": "done", "total_new": 0})
        return 0
    return _check_user(db, user, progress_cb)

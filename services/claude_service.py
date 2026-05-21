"""Claude API integration for relevance scoring and research summaries."""

import json

import anthropic

from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def score_relevance(keyword: str, items: list[dict]) -> list[dict]:
    """Score each item's relevance to keyword and add a one-sentence summary.

    Adds 'relevance_score' (0.0–1.0) and 'summary' keys to each item in-place.
    Falls back to score=0.5 / summary='' if the API is unavailable.

    Args:
        keyword: The user's search keyword.
        items: List of dicts; each must have 'title' and 'abstract' keys.

    Returns:
        Same list with 'relevance_score' and 'summary' added to each item.
    """
    if not items:
        return []

    if not settings.ANTHROPIC_API_KEY:
        for item in items:
            item.setdefault("relevance_score", 0.5)
            item.setdefault("summary", None)  # None signals "no API key" to the frontend
        return items

    items_text = "\n\n".join(
        f"[{i}] {item.get('title') or item.get('name', 'Untitled')}\n"
        f"{(item.get('abstract') or item.get('description', ''))[:300]}"
        for i, item in enumerate(items)
    )

    prompt = (
        f'Evaluate relevance of research content to the keyword: "{keyword}"\n\n'
        "For each item provide:\n"
        f'- score: 0.0–1.0 (how relevant it is to "{keyword}")\n'
        "- summary: one concise sentence describing what this item is about\n\n"
        f"Items:\n{items_text}\n\n"
        "Respond ONLY with a valid JSON array (same order as items):\n"
        '[{"score": 0.95, "summary": "..."}, ...]'
    )

    try:
        response = _client().messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        start = text.find("[")
        end = text.rfind("]") + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON array found in response")
        scores = json.loads(text[start:end])

        for item, score_data in zip(items, scores):
            item["relevance_score"] = float(score_data.get("score", 0.5))
            item["summary"] = score_data.get("summary", "")

    except Exception as exc:
        logger.error("Claude relevance scoring failed: %s", exc)
        for item in items:
            item.setdefault("relevance_score", 0.5)
            item.setdefault("summary", None)

    return items


def generate_overview(keyword: str, papers: list[dict]) -> str:
    """Generate a 2-sentence plain-text overview of research on keyword.

    Args:
        keyword: The research topic.
        papers: List of paper dicts (uses 'title' field for context).

    Returns:
        Plain-text overview string.
    """
    if not settings.ANTHROPIC_API_KEY:
        return None  # None signals "no API key" to the frontend

    if papers:
        titles_block = "Base it on these recent papers:\n" + "\n".join(
            f"- {p.get('title', '')}" for p in papers[:8]
        )
    else:
        titles_block = "No specific papers available — give a general landscape overview."

    try:
        response = _client().messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=200,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f'Write 2 sentences summarizing the current research landscape on "{keyword}" '
                        f"for an AI/ML researcher. {titles_block}\n\nBe specific and informative. No preamble."
                    ),
                }
            ],
        )
        return response.content[0].text.strip()

    except Exception as exc:
        logger.error("Claude overview generation failed: %s", exc)
        return None

"""Claude API integration for on-demand paper and overview summaries."""

from typing import Optional

import anthropic

from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def summarize_paper(abstract: str) -> Optional[str]:
    """Generate a one-sentence summary of a paper from its abstract.

    Args:
        abstract: Paper abstract text.

    Returns:
        One-sentence summary string, or None if API unavailable or abstract empty.
    """
    if not settings.ANTHROPIC_API_KEY or not abstract:
        return None
    try:
        response = _client().messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=100,
            messages=[{
                "role": "user",
                "content": (
                    f"Summarize this paper abstract in one concise sentence:\n\n"
                    f"{abstract[:800]}\n\nNo preamble."
                ),
            }],
        )
        return response.content[0].text.strip()
    except Exception as exc:
        logger.error("Claude paper summary failed: %s", exc)
        return None


def generate_era_summary(topic: str, era_label: str, papers: list[dict]) -> str:
    """Generate a 2-3 sentence summary of how a topic evolved in a given era.

    Args:
        topic: Research topic.
        era_label: Era label string e.g. "2023–2024".
        papers: Papers from that era (uses 'title' field).

    Returns:
        Plain-text summary string, or None if API unavailable.
    """
    if not settings.ANTHROPIC_API_KEY:
        return None

    paper_titles = "\n".join(f"- {p.get('title', '')}" for p in papers[:8])
    try:
        response = _client().messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=200,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f'Summarize how "{topic}" evolved during {era_label} in 2-3 sentences. '
                        f"Key papers from this period:\n{paper_titles}\n\n"
                        "Be specific about what changed or was introduced. No preamble."
                    ),
                }
            ],
        )
        return response.content[0].text.strip()
    except Exception as exc:
        logger.error("Claude era summary failed: %s", exc)
        return None


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

"""Claude API integration for on-demand paper and overview summaries."""

import json
from typing import Optional

import anthropic

from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

_LANG_INSTRUCTION = {
    "ko": "모든 답변을 한국어로 작성하세요.",
    "en": "",
}


def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _lang_suffix(lang: str) -> str:
    return _LANG_INSTRUCTION.get(lang, "")


def summarize_paper(abstract: str, lang: str = "en") -> Optional[str]:
    """Generate a one-sentence summary of a paper from its abstract.

    Args:
        abstract: Paper abstract text.
        lang: Response language code ("en" or "ko").

    Returns:
        One-sentence summary string, or None if API unavailable or abstract empty.
    """
    if not settings.ANTHROPIC_API_KEY or not abstract:
        return None
    lang_note = _lang_suffix(lang)
    try:
        response = _client().messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=150,
            messages=[{
                "role": "user",
                "content": (
                    f"Summarize this paper abstract in one concise sentence:\n\n"
                    f"{abstract[:800]}\n\nNo preamble."
                    + (f" {lang_note}" if lang_note else "")
                ),
            }],
        )
        return response.content[0].text.strip()
    except Exception as exc:
        logger.error("Claude paper summary failed: %s", exc)
        return None


def generate_era_analysis(
    topic: str,
    era_label: str,
    papers: list[dict],
    lang: str = "en",
) -> Optional[dict]:
    """Generate era summary and per-paper analysis using paper abstracts.

    Sends up to 10 papers (title + first 400 chars of abstract) to Claude and asks
    for a JSON response with an era-level summary and per-paper breakdown of
    problem / solution / significance / limitations.

    Args:
        topic: Research topic.
        era_label: Era label string e.g. "2023–2024".
        papers: Papers from that era (title + abstract fields used).
        lang: Response language code ("en" or "ko").

    Returns:
        Dict with 'summary' (str) and 'papers' (list of {index, problem, solution,
        significance, limitations}), or None if API unavailable or call fails.
    """
    if not settings.ANTHROPIC_API_KEY:
        return None

    papers_block = ""
    for i, p in enumerate(papers[:10], 1):
        title = p.get("title", "")
        abstract = (p.get("abstract") or "")[:400]
        papers_block += f"[{i}] {title}\n{abstract}\n\n"

    lang_note = _lang_suffix(lang)

    try:
        response = _client().messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=2000,
            messages=[{
                "role": "user",
                "content": (
                    f'Analyze how "{topic}" evolved during {era_label}.\n\n'
                    f"Papers:\n{papers_block}\n"
                    "Return valid JSON only, no markdown fences:\n"
                    '{"summary":"2-3 sentences on key developments this era",'
                    '"papers":[{"index":1,"problem":"what prior limitation this addressed",'
                    '"solution":"how this paper solved it",'
                    '"significance":"key impact or contribution",'
                    '"limitations":"key limitations or open problems left"}]}'
                    + (f"\n{lang_note}" if lang_note else "")
                ),
            }],
        )
        text = response.content[0].text.strip()
        if text.startswith("```"):
            text = "\n".join(text.split("\n")[1:])
            text = text.rsplit("```", 1)[0].strip()
        return json.loads(text)
    except Exception as exc:
        logger.error("Claude era analysis failed: %s", exc)
        return None


def generate_overview(keyword: str, papers: list[dict], lang: str = "en") -> str:
    """Generate a 2-sentence plain-text overview of research on keyword.

    Args:
        keyword: The research topic.
        papers: List of paper dicts (uses 'title' field for context).
        lang: Response language code ("en" or "ko").

    Returns:
        Plain-text overview string.
    """
    if not settings.ANTHROPIC_API_KEY:
        return None

    if papers:
        titles_block = "Base it on these recent papers:\n" + "\n".join(
            f"- {p.get('title', '')}" for p in papers[:8]
        )
    else:
        titles_block = "No specific papers available — give a general landscape overview."

    lang_note = _lang_suffix(lang)

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
                        + (f" {lang_note}" if lang_note else "")
                    ),
                }
            ],
        )
        return response.content[0].text.strip()

    except Exception as exc:
        logger.error("Claude overview generation failed: %s", exc)
        return None

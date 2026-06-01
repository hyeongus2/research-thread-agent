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
    """Generate a short summary of a paper from its abstract.

    Args:
        abstract: Paper abstract text.
        lang: Response language code ("en" or "ko").

    Returns:
        2-3 sentence summary string, or None if API unavailable or abstract empty.
    """
    if not settings.ANTHROPIC_API_KEY or not abstract:
        return None
    lang_note = _lang_suffix(lang)
    try:
        response = _client().messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=600,
            messages=[{
                "role": "user",
                "content": (
                    f"Summarize this paper abstract in 3-4 complete plain sentences. "
                    f"Cover: (1) the problem addressed, (2) the proposed approach, (3) key results or contributions, (4) broader impact if notable. "
                    f"Write as plain prose — no markdown, no bullet points, no bold, no headers. "
                    f"Do not cut off mid-sentence.\n\n"
                    f"{abstract}\n\nNo preamble."
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
        abstract = p.get("abstract") or ""
        papers_block += f"[{i}] {title}\n{abstract}\n\n"

    lang_note = _lang_suffix(lang)

    try:
        response = _client().messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=8000,
            messages=[{
                "role": "user",
                "content": (
                    f'You are an expert AI/ML researcher. Analyze how "{topic}" evolved during {era_label} '
                    f"based on the papers below.\n\n"
                    f"Papers:\n{papers_block}\n"
                    "Return valid JSON only, no markdown fences. All string values must be plain prose — "
                    "no markdown, no bullet points, no bold, no headers.\n\n"
                    "For the era summary: write 3-4 sentences describing the dominant research directions, "
                    "key breakthroughs, and how the field shifted during this period.\n\n"
                    "For each paper, write 2-4 substantive sentences per field:\n"
                    "  problem: What specific technical or scientific limitation did this paper address? "
                    "What was the state of the field before this work, and why was this problem important?\n"
                    "  solution: What is the core technical approach or methodology? "
                    "Explain the key idea, architecture, or algorithm concretely.\n"
                    "  significance: What did this work enable or change? "
                    "How did it advance the field beyond prior work, and what follow-on research did it inspire?\n"
                    "  limitations: What does this approach not handle well, or what assumptions does it rely on? "
                    "What open problems remain after this work?\n\n"
                    'JSON schema: {"summary":"...","papers":[{"index":1,"problem":"...","solution":"...","significance":"...","limitations":"..."}]}'
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
    """Generate a plain-text overview of research on keyword.

    Args:
        keyword: The research topic.
        papers: List of paper dicts (uses 'title' and 'abstract' fields for context).
            Capped to top 20 papers with first 250 chars of abstract to keep input concise.
        lang: Response language code ("en" or "ko").

    Returns:
        Plain-text overview string (2-3 paragraphs, no markdown).
    """
    if not settings.ANTHROPIC_API_KEY:
        return None

    if papers:
        papers_block = "Based on these papers:\n"
        for p in papers:
            title = p.get("title", "")
            abstract = p.get("abstract") or ""
            papers_block += f"- {title}"
            if abstract:
                papers_block += f"\n  {abstract}"
            papers_block += "\n"
    else:
        papers_block = "No specific papers available — give a general landscape overview."

    lang_note = _lang_suffix(lang)

    try:
        response = _client().messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=4000,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f'Write a 3-paragraph overview of the current research landscape on "{keyword}" '
                        f"for an AI/ML researcher. Cover: (1) the core problem and dominant approaches, "
                        f"(2) major milestones and current trends, "
                        f"(3) practical applications and open challenges. "
                        f"Write as plain prose — no markdown, no bullet points, no bold, no headers. "
                        f"Each paragraph must be 4-6 complete sentences. Always finish the final sentence completely.\n\n"
                        f"{papers_block}\n\nBe specific and informative. No preamble."
                        + (f" {lang_note}" if lang_note else "")
                    ),
                }
            ],
        )
        return response.content[0].text.strip()

    except Exception as exc:
        logger.error("Claude overview generation failed: %s", exc)
        return None

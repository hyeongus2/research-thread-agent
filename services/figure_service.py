"""Extract a paper's first figure image from arxiv-derived HTML renderings.

Primary source is ar5iv (https://ar5iv.labs.arxiv.org), which renders arXiv
papers as HTML. We look for the first <figure class="ltx_figure"> and return
its image URL. This usually corresponds to Figure 1 of the paper.

Returns None when:
  - arxiv_id is missing
  - the paper has no ar5iv rendering
  - HTML structure doesn't match (unlikely)
  - network request fails or times out

Results should be cached by callers — ar5iv responses are slow (~1-3 s).
"""

import re
from typing import Optional

import requests

from utils.logger import get_logger

logger = get_logger(__name__)

_AR5IV_URL = "https://ar5iv.labs.arxiv.org/html/{arxiv_id}"
_TIMEOUT = 10

# Match the first <figure class="ltx_figure"> ... <img src="..."> in the document.
# ar5iv consistently uses the ltx_* class scheme inherited from LaTeXML.
_FIGURE_RE = re.compile(
    r'<figure[^>]*class="[^"]*ltx_figure[^"]*"[^>]*>.*?<img[^>]+src="([^"]+)"',
    re.DOTALL | re.IGNORECASE,
)

# Fallback: a standalone graphics image (some papers wrap figures differently).
_GRAPHICS_RE = re.compile(
    r'<img[^>]+class="[^"]*ltx_graphics[^"]*"[^>]+src="([^"]+)"',
    re.IGNORECASE,
)


def _absolutize(src: str, arxiv_id: str) -> str:
    """Resolve a possibly-relative image URL against the ar5iv paper page."""
    if src.startswith("http://") or src.startswith("https://"):
        return src
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("/"):
        return "https://ar5iv.labs.arxiv.org" + src
    # Treat as relative to the paper directory
    return f"https://ar5iv.labs.arxiv.org/html/{arxiv_id}/{src}"


def fetch_first_figure(arxiv_id: str) -> Optional[str]:
    """Return the URL of the paper's first figure, or None.

    Args:
        arxiv_id: arXiv identifier (e.g. "2408.06292" or "cs.CL/0123456").

    Returns:
        Absolute image URL string, or None when unavailable.
    """
    if not arxiv_id:
        return None
    url = _AR5IV_URL.format(arxiv_id=arxiv_id)
    try:
        resp = requests.get(url, timeout=_TIMEOUT, headers={"User-Agent": "research-thread-agent/1.0"})
        if not resp.ok:
            logger.debug("ar5iv %s returned %s", arxiv_id, resp.status_code)
            return None
        html = resp.text
    except Exception as exc:
        logger.debug("ar5iv fetch failed for %s: %s", arxiv_id, exc)
        return None

    match = _FIGURE_RE.search(html) or _GRAPHICS_RE.search(html)
    if not match:
        return None
    return _absolutize(match.group(1), arxiv_id)

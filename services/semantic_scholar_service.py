"""Paper search via Semantic Scholar (primary) with OpenAlex fallback."""

import threading
import time
from datetime import date
from typing import Optional

import requests

from config.settings import settings
from utils.logger import get_logger

logger = get_logger(__name__)

# Known AI/ML acronyms and their full-form expansions.
# Query is sent as "ABBREV full expansion" so SS finds both forms.
_ACRONYM_EXPANSIONS: dict[str, str] = {
    "rag":   "retrieval augmented generation",
    "llm":   "large language model",
    "llms":  "large language models",
    "rl":    "reinforcement learning",
    "nlp":   "natural language processing",
    "cv":    "computer vision",
    "vae":   "variational autoencoder",
    "gan":   "generative adversarial network",
    "gans":  "generative adversarial networks",
    "rnn":   "recurrent neural network",
    "cnn":   "convolutional neural network",
    "lstm":  "long short-term memory",
    "bert":  "bidirectional encoder representations transformers",
    "gpt":   "generative pre-trained transformer",
    "vlm":   "vision language model",
    "moe":   "mixture of experts",
    "rlhf":  "reinforcement learning from human feedback",
    "dpo":   "direct preference optimization",
    "ppo":   "proximal policy optimization",
    "sft":   "supervised fine-tuning",
    "lora":  "low-rank adaptation",
    "clip":  "contrastive language image pretraining",
    "sam":   "segment anything model",
    "t5":    "text-to-text transfer transformer",
    "mamba": "state space model sequence modeling",
}


def _expand_query(query: str) -> str:
    """Append full-form expansion for known AI/ML acronyms in the query.

    Each token that matches a known acronym gets its expansion appended inline.
    Unknown queries are returned unchanged.
    Examples:
        "RAG" -> "RAG retrieval augmented generation"
        "RAG evaluation" -> "RAG retrieval augmented generation evaluation"
        "transformer" -> "transformer"  (not an acronym, no change)
    """
    tokens = query.strip().split()
    result = []
    changed = False
    for tok in tokens:
        expansion = _ACRONYM_EXPANSIONS.get(tok.lower())
        if expansion:
            result.append(f"{tok} {expansion}")
            changed = True
        else:
            result.append(tok)
    return " ".join(result) if changed else query.strip()


# Global semaphore: limit concurrent Semantic Scholar API calls to 1.
# Prevents My Feed, Quick Search, and Learning Path from competing for
# the same rate limit window and triggering cascading 429s.
_ss_lock = threading.Semaphore(1)

_SS_BULK_URL = "https://api.semanticscholar.org/graph/v1/paper/search/bulk"
_SS_FIELDS = (
    "title,authors,year,citationCount,publicationVenue,"
    "externalIds,abstract,openAccessPdf,publicationDate"
)

_OA_URL = "https://api.openalex.org/works"


def _reconstruct_abstract(inv_index: Optional[dict]) -> str:
    """Reconstruct plain-text abstract from OpenAlex inverted index."""
    if not inv_index:
        return ""
    try:
        positions: dict[int, str] = {}
        for word, pos_list in inv_index.items():
            for pos in pos_list:
                positions[pos] = word
        return " ".join(positions[i] for i in sorted(positions))
    except Exception:
        return ""


def _parse_paper(p: dict) -> dict:
    paper_id = p.get("paperId") or ""
    url = f"https://www.semanticscholar.org/paper/{paper_id}" if paper_id else ""
    pdf_url = (p.get("openAccessPdf") or {}).get("url") or ""
    venue_obj = p.get("publicationVenue") or {}
    venue = venue_obj.get("name") or ""
    pub_date = p.get("publicationDate") or (str(p["year"]) if p.get("year") else "")
    authors = [a.get("name", "") for a in (p.get("authors") or [])[:5]]
    arxiv_id = (p.get("externalIds") or {}).get("ArXiv") or ""
    return {
        "paper_id": paper_id,
        "title": p.get("title") or "",
        "authors": authors,
        "abstract": p.get("abstract") or "",
        "url": url,
        "pdf_url": pdf_url,
        "published_date": pub_date,
        "citation_count": p.get("citationCount") or 0,
        "venue": venue,
        "arxiv_id": arxiv_id,
    }


def _search_semantic_scholar(
    keyword: str,
    start_date: Optional[date],
    end_date: Optional[date],
    limit: int,
    fields_of_study: Optional[str] = None,
) -> list[dict]:
    params: dict = {
        "query": keyword,
        "limit": min(limit, 1000),
        "fields": _SS_FIELDS,
        "sort": "citationCount:desc",
    }
    if fields_of_study:
        params["fieldsOfStudy"] = fields_of_study
    if start_date or end_date:
        year_from = str(start_date.year) if start_date else ""
        year_to = str(end_date.year) if end_date else ""
        params["year"] = f"{year_from}-{year_to}"

    headers = {}
    if settings.SEMANTIC_SCHOLAR_API_KEY:
        headers["x-api-key"] = settings.SEMANTIC_SCHOLAR_API_KEY

    def _do_request(p: dict):
        return requests.get(_SS_BULK_URL, params=p, headers=headers, timeout=30)

    with _ss_lock:
        resp = _do_request(params)

        if resp.status_code == 429:
            logger.warning("Semantic Scholar bulk 429; retrying after 2 s")
            time.sleep(2)
            resp = _do_request(params)
        if resp.status_code == 429:
            logger.warning("Semantic Scholar bulk 429 again; falling back to OpenAlex")
            resp.raise_for_status()

        if resp.status_code == 403 and "year" in params:
            logger.warning("Semantic Scholar bulk 403 with year filter; retrying without date")
            params = {k: v for k, v in params.items() if k != "year"}
            resp = _do_request(params)

        if resp.status_code == 403:
            logger.warning("Semantic Scholar bulk 403 (IP rate limit); raising for fallback")
            resp.raise_for_status()

        resp.raise_for_status()
        time.sleep(1.0)
    data = resp.json()

    papers = [_parse_paper(p) for p in data.get("data", [])]
    papers.sort(key=lambda x: x.get("citation_count", 0), reverse=True)
    logger.info("Semantic Scholar bulk '%s' → %d papers", keyword, len(papers))
    return papers


def _search_openalex(
    keyword: str,
    start_date: Optional[date],
    end_date: Optional[date],
    limit: int,
) -> list[dict]:
    params: dict = {
        "search": keyword,
        "sort": "cited_by_count:desc",
        "per-page": min(limit, 200),
        "mailto": "research-thread@local",
    }
    filters = ["type:article"]
    if start_date:
        filters.append(f"from_publication_date:{start_date.isoformat()}")
    if end_date:
        filters.append(f"to_publication_date:{end_date.isoformat()}")
    params["filter"] = ",".join(filters)

    resp = requests.get(_OA_URL, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    papers = []
    for w in data.get("results", []):
        doi = w.get("doi") or ""
        loc = w.get("primary_location") or {}
        url = loc.get("landing_page_url") or doi or ""
        pdf_url = loc.get("pdf_url") or (w.get("open_access") or {}).get("oa_url") or ""
        venue = (loc.get("source") or {}).get("display_name") or ""
        authors = [
            a["author"]["display_name"]
            for a in (w.get("authorships") or [])[:5]
            if (a.get("author") or {}).get("display_name")
        ]
        abstract = _reconstruct_abstract(w.get("abstract_inverted_index"))

        papers.append({
            "paper_id": "",  # OpenAlex results have no Semantic Scholar paperId
            "title": w.get("display_name") or "",
            "authors": authors,
            "abstract": abstract,
            "url": url,
            "pdf_url": pdf_url,
            "published_date": w.get("publication_date") or "",
            "citation_count": w.get("cited_by_count") or 0,
            "venue": venue,
        })

    papers.sort(key=lambda x: x.get("citation_count", 0), reverse=True)
    logger.info("OpenAlex '%s' → %d papers (fallback)", keyword, len(papers))
    return papers


def search_papers(
    keyword: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 50,
    _source_out: Optional[list] = None,
    fields_of_study: Optional[str] = None,
) -> list[dict]:
    """Search for papers relevant to keyword.

    Tries Semantic Scholar first (citation-sorted). Falls back to OpenAlex
    if Semantic Scholar is rate-limited or unavailable.

    Args:
        keyword: Search query string.
        start_date: Filter to papers published on or after this date.
        end_date: Filter to papers published on or before this date.
        limit: Maximum papers to return.
        _source_out: Optional single-element list; if provided, will be set to
            the name of the source actually used ("Semantic Scholar" or "OpenAlex").
        fields_of_study: Optional SS fieldsOfStudy filter (e.g. "Computer Science").

    Returns:
        List of paper dicts sorted by citation count desc.
    """
    ss_query = _expand_query(keyword)
    try:
        result = _search_semantic_scholar(ss_query, start_date, end_date, limit, fields_of_study)
        if _source_out is not None:
            _source_out.append("Semantic Scholar")
        return result
    except requests.RequestException as ss_exc:
        logger.warning("Semantic Scholar unavailable (%s); falling back to OpenAlex", ss_exc)
        try:
            result = _search_openalex(keyword, start_date, end_date, limit)
            if _source_out is not None:
                _source_out.append("OpenAlex")
            return result
        except requests.RequestException as oa_exc:
            logger.error("OpenAlex fallback also failed: %s", oa_exc)
            raise ss_exc


def get_paper_references(paper_id: str, limit: int = 30) -> list[dict]:
    """Fetch papers cited by paper_id using the Semantic Scholar references endpoint.

    Returns list of paper dicts (same shape as search_papers output) with an
    additional 'is_influential' bool from the citation relationship metadata.
    """
    url = f"https://api.semanticscholar.org/graph/v1/paper/{paper_id}/references"
    params = {
        "fields": (
            "paperId,title,authors,year,citationCount,publicationVenue,"
            "abstract,openAccessPdf,externalIds"
        ),
        "limit": min(limit, 500),
    }
    headers = {}
    if settings.SEMANTIC_SCHOLAR_API_KEY:
        headers["x-api-key"] = settings.SEMANTIC_SCHOLAR_API_KEY

    with _ss_lock:
        resp = requests.get(url, params=params, headers=headers, timeout=30)
        if resp.status_code == 429:
            logger.warning("SS references 429 for %s; retrying after 2 s", paper_id)
            time.sleep(2)
            resp = requests.get(url, params=params, headers=headers, timeout=30)
        time.sleep(1.0)
    if resp.status_code != 200:
        logger.warning("SS references fetch failed: %s → %d", paper_id, resp.status_code)
        return []

    results = []
    for item in resp.json().get("data", []):
        p = item.get("citedPaper") or {}
        pid = p.get("paperId") or ""
        if not pid:
            continue
        venue_obj = p.get("publicationVenue") or {}
        arxiv_id = (p.get("externalIds") or {}).get("ArXiv") or ""
        year_raw = p.get("year")
        results.append({
            "paper_id": pid,
            "title": p.get("title") or "",
            "authors": [a.get("name", "") for a in (p.get("authors") or [])[:5]],
            "abstract": p.get("abstract") or "",
            "url": f"https://www.semanticscholar.org/paper/{pid}",
            "pdf_url": (p.get("openAccessPdf") or {}).get("url") or "",
            "published_date": str(year_raw) if year_raw else "",
            "citation_count": p.get("citationCount") or 0,
            "venue": venue_obj.get("name") or "",
            "arxiv_id": arxiv_id,
            "is_influential": bool(item.get("isInfluential")),
        })
    logger.info("SS references '%s' → %d papers", paper_id, len(results))
    return results

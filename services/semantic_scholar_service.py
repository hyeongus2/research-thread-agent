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
# Only applied when the query is a single token (acronym alone).
# Multi-token queries are sent as-is to avoid distorting SS relevance ranking.
_ACRONYM_EXPANSIONS: dict[str, str] = {
    # --- Foundational architectures ---
    "rnn":    "recurrent neural network",
    "cnn":    "convolutional neural network",
    "lstm":   "long short-term memory",
    "gru":    "gated recurrent unit",
    "mlp":    "multilayer perceptron",
    "vae":    "variational autoencoder",
    "gan":    "generative adversarial network",
    "gans":   "generative adversarial networks",
    "nf":     "normalizing flow",
    "ssm":    "state space model",
    "mamba":  "mamba state space model selective",
    "rwkv":   "receptance weighted key value",
    # --- Transformers & attention ---
    "bert":   "bidirectional encoder representations transformers",
    "gpt":    "generative pre-trained transformer",
    "t5":     "text-to-text transfer transformer",
    "vit":    "vision transformer",
    "dit":    "diffusion transformer",
    "mha":    "multi-head attention",
    "mqa":    "multi-query attention",
    "gqa":    "grouped query attention",
    "rope":   "rotary position embedding",
    "alibi":  "attention with linear biases",
    # --- Large language models ---
    "llm":    "large language model",
    "llms":   "large language models",
    "lvlm":   "large vision language model",
    "mllm":   "multimodal large language model",
    "lmm":    "large multimodal model",
    "vlm":    "vision language model",
    "slm":    "small language model",
    "vla":    "vision language action model",
    # --- Retrieval & RAG ---
    "rag":    "retrieval augmented generation",
    "dpr":    "dense passage retrieval",
    "dr":     "dense retrieval",
    "ir":     "information retrieval",
    # --- Fine-tuning & alignment ---
    "sft":    "supervised fine-tuning",
    "rlhf":   "reinforcement learning from human feedback",
    "rlaif":  "reinforcement learning from ai feedback",
    "dpo":    "direct preference optimization",
    "ppo":    "proximal policy optimization",
    "grpo":   "group relative policy optimization",
    "kto":    "kahneman-tversky optimization",
    "orpo":   "odds ratio preference optimization",
    "cpo":    "contrastive preference optimization",
    "simpo":  "simple preference optimization",
    "cai":    "constitutional ai",
    "rm":     "reward model",
    "prm":    "process reward model",
    # --- Efficient fine-tuning / compression ---
    "lora":   "low-rank adaptation",
    "qlora":  "quantized low-rank adaptation",
    "peft":   "parameter efficient fine-tuning",
    "moe":    "mixture of experts",
    "quant":  "model quantization",
    # --- Reasoning & agents ---
    "cot":    "chain of thought reasoning",
    "tot":    "tree of thoughts reasoning",
    "icl":    "in-context learning",
    "react":  "reasoning acting language model agent",
    # --- Diffusion & generation ---
    "ddpm":   "denoising diffusion probabilistic model",
    "ddim":   "denoising diffusion implicit model",
    "cfg":    "classifier-free guidance diffusion",
    "fm":     "flow matching generative model",
    # --- Vision ---
    "clip":   "contrastive language image pretraining",
    "sam":    "segment anything model",
    "nerf":   "neural radiance field",
    "3dgs":   "3d gaussian splatting",
    "slam":   "simultaneous localization and mapping",
    "vqa":    "visual question answering",
    # --- NLP tasks ---
    "nlp":    "natural language processing",
    "nlu":    "natural language understanding",
    "nlg":    "natural language generation",
    "nmt":    "neural machine translation",
    "ner":    "named entity recognition",
    "qa":     "question answering",
    "mrc":    "machine reading comprehension",
    "nli":    "natural language inference",
    # --- Speech & audio ---
    "asr":    "automatic speech recognition",
    "tts":    "text-to-speech synthesis",
    # --- Reinforcement learning ---
    "rl":     "reinforcement learning",
    "drl":    "deep reinforcement learning",
    "mbrl":   "model-based reinforcement learning",
    "marl":   "multi-agent reinforcement learning",
    "irl":    "inverse reinforcement learning",
    "mdp":    "markov decision process",
    "mcts":   "monte carlo tree search",
    # --- Graph & structured ---
    "gnn":    "graph neural network",
    "gcn":    "graph convolutional network",
    "gat":    "graph attention network",
    "kg":     "knowledge graph",
    # --- General ML ---
    "cv":     "computer vision",
    "ml":     "machine learning",
    "dl":     "deep learning",
    "fl":     "federated learning",
    "ssl":    "self-supervised learning",
    "cl":     "contrastive learning",
    "meta":   "meta-learning few-shot",
    "nas":    "neural architecture search",
}


def _expand_query(query: str) -> str:
    """Expand query only when it is a single known AI/ML acronym.

    Multi-token queries are returned unchanged to avoid distorting SS ranking.
    Examples:
        "RAG"            -> "RAG retrieval augmented generation"
        "RAG evaluation" -> "RAG evaluation"   (multi-token, no change)
        "transformer"    -> "transformer"      (not in dict, no change)
    """
    tokens = query.strip().split()
    if len(tokens) != 1:
        return query.strip()
    expansion = _ACRONYM_EXPANSIONS.get(tokens[0].lower())
    return f"{tokens[0]} {expansion}" if expansion else query.strip()


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

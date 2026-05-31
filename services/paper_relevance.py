"""Deterministic paper relevance scoring and filtering for AI/ML research.

Filters out papers that lack AI/ML relevance (e.g., electrical transformers,
physical diffusion processes, clinical attention disorders) while preserving
interdisciplinary AI/ML papers (protein design, genomics, drug discovery, etc.).

No LLM calls. No external dependencies beyond the standard library.
"""

import logging
import re
from math import log1p

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# NOTE: No longer used for filtering decisions — ambiguity is now detected
# automatically from query length + ML signal strength. Kept only as the
# key set for _EXPAND_MAP lookups.
AMBIGUOUS_AI_TERMS = {
    "transformer", "diffusion", "attention", "alignment",
    "agent", "embedding", "retrieval", "foundation",
}

# If the user query explicitly contains any of these, we treat the query as
# intentionally interdisciplinary and do NOT tighten the ambiguity filter.
APPLIED_DOMAIN_TERMS = {
    "protein", "molecule", "drug", "genomics", "genome",
    "rna", "dna", "single-cell", "singlecell", "medical", "imaging",
    "chemistry", "biology", "enzyme", "ligand", "clinical",
}

_STOPWORDS = {
    "the", "a", "an", "of", "for", "and", "or", "in", "on",
    "with", "using", "based", "approach", "method", "study",
    "via", "to", "from", "is", "are", "that", "this",
}

_EXPAND_MAP: dict[str, list[str]] = {
    "transformer":      ["transformer", "attention", "neural", "network", "language", "model"],
    "diffusion":        ["diffusion", "generative", "model", "denoising", "score"],
    "diffusion model":  ["diffusion", "generative", "model", "denoising", "score"],
    "attention":        ["attention", "mechanism", "neural", "transformer"],
    "alignment":        ["alignment", "ai", "machine", "learning", "language", "model"],
    "agent":            ["agent", "llm", "reasoning", "planning"],
    "retrieval":        ["retrieval", "information", "neural", "search", "augmented"],
    "embedding":        ["embedding", "representation", "neural"],
    "foundation":       ["foundation", "model", "representation", "learning"],
    "foundation model": ["foundation", "model", "representation", "learning"],
}

# Strong AI/ML phrases — each hit adds +0.40, capped at 0.80
_STRONG_PHRASES = [
    "machine learning", "deep learning",
    "neural network", "neural networks",
    "language model", "large language model", "language models",
    "foundation model", "foundation models",
    "diffusion model", "diffusion models",
    "score-based", "denoising diffusion",
    "graph neural", "graph neural network",
    "reinforcement learning",
    "self-supervised", "contrastive learning",
    "representation learning",
]

# Medium AI/ML phrases — each hit adds +0.15, capped at 0.30
_MEDIUM_PHRASES = [
    "attention mechanism", "fine-tuning", "pre-trained", "pretrained",
    "multimodal", "retrieval augmented", "retrieval-augmented",
    "benchmark", "dataset", "training data",
    "transfer learning", "few-shot", "zero-shot",
    "vision-language", "vision language",
]

# Individual ML terms — each hit adds +0.05, capped at 0.20
# (special-cased terms below get smaller bonuses; see _compute_ai_ml_relevance)
_WEAK_TERMS = [
    "neural", "learning", "training", "classification", "segmentation",
    "prediction", "optimization", "encoder", "decoder", "token", "tokens",
    "generative", "autoregressive", "attention",
]

# These words require ML-context neighbours to count properly
_CONTEXT_DEPENDENT = {"attention", "diffusion", "transformer"}

_ML_CONTEXT_WORDS = {
    "neural", "network", "networks", "learning", "model", "models",
    "language", "architecture", "attention", "generative", "denoising",
    "score", "diffusion", "embedding", "encoder", "decoder",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalize_query_terms(query: str) -> list[str]:
    """Return meaningful lowercase tokens from a query, preserving domain terms."""
    text = re.sub(r"[^\w\s-]", " ", query.lower())
    tokens = [t for t in text.split() if t and t not in _STOPWORDS and len(t) > 1]
    return tokens


def _has_applied_domain_term(query_lower: str) -> bool:
    words = set(re.sub(r"[^\w\s-]", " ", query_lower).split())
    return bool(words & APPLIED_DOMAIN_TERMS)


def expand_ambiguous_ai_query(query: str) -> list[str]:
    """Return expanded token list for ambiguous single AI/ML terms.

    Only expands when the query is a known ambiguous AI term and does not
    contain explicit applied-domain terms (protein, molecule, etc.).
    """
    q = query.strip().lower()

    # If interdisciplinary domain terms present, keep original tokens
    if _has_applied_domain_term(q):
        return normalize_query_terms(query)

    # Check exact match in expand map
    if q in _EXPAND_MAP:
        return _EXPAND_MAP[q]

    tokens = normalize_query_terms(query)
    token_set = set(tokens)

    # Single-token ambiguous query
    if len(token_set) == 1 and token_set & AMBIGUOUS_AI_TERMS:
        term = next(iter(token_set))
        return _EXPAND_MAP.get(term, tokens)

    return tokens


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def compute_query_relevance(query: str, paper: dict) -> float:
    """Score how well a paper matches the user's query (0–1).

    Uses title, abstract, and an expanded token set for ambiguous AI queries.
    """
    title = (paper.get("title") or "").lower()
    abstract = (paper.get("abstract") or "").lower()
    q_norm = query.strip().lower()

    score = 0.0

    # Full phrase match
    if q_norm and q_norm in title:
        score += 0.40
    elif q_norm and q_norm in abstract:
        score += 0.20

    # Token coverage
    tokens = expand_ambiguous_ai_query(query)
    if tokens:
        title_hits = sum(1 for t in tokens if t in title)
        score += (title_hits / len(tokens)) * 0.25
        if abstract:
            abs_hits = sum(1 for t in tokens if t in abstract)
            score += (abs_hits / len(tokens)) * 0.10

    return min(1.0, score)


def compute_ai_ml_relevance(query: str, paper: dict) -> float:
    """Score how AI/ML-oriented a paper is (0–1).

    Intentionally lenient for interdisciplinary papers (protein + deep learning).
    Penalises papers that use ambiguous terms only in a non-ML sense.
    """
    title = (paper.get("title") or "").lower()
    abstract = (paper.get("abstract") or "").lower()
    text = f"{title} {abstract}"

    score = 0.0

    # Strong AI/ML phrases
    strong_hits = sum(0.40 for p in _STRONG_PHRASES if p in text)
    score += min(0.80, strong_hits)

    # Medium phrases
    medium_hits = sum(0.15 for p in _MEDIUM_PHRASES if p in text)
    score += min(0.30, medium_hits)

    # Weak individual terms (with context-dependency guards)
    for term in _WEAK_TERMS:
        if term not in text:
            continue
        if term in _CONTEXT_DEPENDENT:
            # Only award points if ML-context neighbours present
            context = _ML_CONTEXT_WORDS - {term}
            has_context = any(c in text for c in context)
            score += 0.03 if not has_context else 0.05
        else:
            score += 0.05

    # "model" alone is too generic
    if "model" in text and score < 0.05:
        score += 0.03

    # "transformer" alone without ML context: tiny bump
    if "transformer" in text:
        ml_ctx = {"attention", "neural", "language", "architecture", "network"}
        if not any(c in text for c in ml_ctx):
            score = max(score, 0.03)

    return min(1.0, score)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def rerank_and_filter_papers(
    query: str,
    papers: list[dict],
    final_limit: int,
) -> list[dict]:
    """Rerank papers by combined relevance + citation score, filter low-relevance.

    Scoring formula:
        final_score = 0.55 * query_relevance + 0.30 * ai_ml_relevance + 0.15 * citation_score

    Filtering thresholds:
        - Generic ambiguous query (e.g. "transformer"):
              ai_ml_relevance >= 0.25 AND final_score >= 0.25
        - Interdisciplinary query with domain terms OR multi-word specific query:
              query_relevance >= 0.15 OR final_score >= 0.25

    Falls back to citation-sorted originals if filtering removes everything.
    """
    if not papers:
        return []

    q_lower = query.strip().lower()
    has_domain = _has_applied_domain_term(q_lower)

    # Automatically detect ambiguous queries — no hardcoded term list needed.
    # A query is "ambiguous" when:
    #   1. It has ≤ 2 meaningful tokens (short = inherently less specific)
    #   2. The query text itself carries little AI/ML signal
    #   3. The user hasn't added applied-domain context (protein, genomics, etc.)
    #
    # This handles abbreviations (VAE, GAN, RNN) and single common words
    # (transformer, diffusion) automatically without manual maintenance.
    tokens = normalize_query_terms(query)
    query_ml_signal = compute_ai_ml_relevance(query, {"title": query, "abstract": ""})
    is_ambiguous = (
        not has_domain
        and len(tokens) <= 2
        and query_ml_signal < 0.20
    )

    max_cit = max((p.get("citation_count") or 0 for p in papers), default=1) or 1

    scored: list[tuple[float, dict]] = []
    for p in papers:
        cit_score = log1p(p.get("citation_count") or 0) / log1p(max_cit)
        q_rel = compute_query_relevance(query, p)
        ai_rel = compute_ai_ml_relevance(query, p)
        final = 0.55 * q_rel + 0.30 * ai_rel + 0.15 * cit_score

        p = dict(p)  # shallow copy to avoid mutating caller's list
        p["_query_relevance"] = round(q_rel, 3)
        p["_ai_ml_relevance"] = round(ai_rel, 3)
        p["_final_score"] = round(final, 3)
        scored.append((final, p))

    # Apply filter
    if is_ambiguous:
        filtered = [
            (s, p) for s, p in scored
            if p["_ai_ml_relevance"] >= 0.25 and s >= 0.25
        ]
    else:
        filtered = [
            (s, p) for s, p in scored
            if p["_query_relevance"] >= 0.15 or s >= 0.25
        ]

    if not filtered:
        logger.warning(
            "Relevance filtering removed all papers for query '%s'; "
            "falling back to citation-sorted originals.",
            query,
        )
        filtered = scored  # keep all, still reranked by final_score

    filtered.sort(key=lambda x: x[0], reverse=True)
    result = [p for _, p in filtered[:final_limit]]

    logger.info(
        "Relevance filter [%s]: %d → %d papers | top3: %s",
        query,
        len(papers),
        len(result),
        [(p["title"][:40], p["_query_relevance"], p["_ai_ml_relevance"])
         for p in result[:3]],
    )
    return result

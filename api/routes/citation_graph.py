from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.schemas import CitationGraphRequest
from services.database_service import (
    delete_lp_history_item,
    get_cached_historical_thread,
    get_citation_history,
    save_historical_thread,
)
from utils.database import get_db

router = APIRouter()

_CACHE_KEY_PREFIX = "citation::"


@router.get("/citation-graph/history")
def list_citation_history(db: Session = Depends(get_db)):
    return get_citation_history(db)


@router.delete("/citation-graph/history")
def delete_citation_history(query: str, db: Session = Depends(get_db)):
    ok = delete_lp_history_item(db, f"{_CACHE_KEY_PREFIX}{query.strip().lower()}")
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"deleted": True}


@router.post("/citation-graph")
def get_citation_graph(body: CitationGraphRequest, db: Session = Depends(get_db)):
    cache_key = f"{_CACHE_KEY_PREFIX}{body.query.strip().lower()}"

    cached = get_cached_historical_thread(db, cache_key)
    if cached:
        cached["cache_hit"] = True
        return cached

    from services.citation_graph_service import build_citation_graph
    result = build_citation_graph(
        query=body.query,
        max_seed_papers=body.max_seed_papers,
        max_depth=body.max_depth,
        min_citations=body.min_citations,
    )

    if result.get("nodes"):
        save_historical_thread(db, topic=cache_key, data=result)

    result["cache_hit"] = False
    return result

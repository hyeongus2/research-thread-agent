from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.schemas import ResearcherNetworkRequest
from services.database_service import (
    delete_lp_history_item,
    get_cached_historical_thread,
    get_network_history,
    save_historical_thread,
)
from utils.database import get_db

router = APIRouter()

_CACHE_KEY_PREFIX = "network::"


@router.get("/researcher-network/history")
def list_network_history(db: Session = Depends(get_db)):
    return get_network_history(db)


@router.delete("/researcher-network/history")
def delete_network_history(topic: str, db: Session = Depends(get_db)):
    ok = delete_lp_history_item(db, topic)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    return {"deleted": True}


@router.post("/researcher-network")
def get_researcher_network(body: ResearcherNetworkRequest, db: Session = Depends(get_db)):
    name_key = body.root_author_name.strip().lower()
    ys = body.year_start if body.year_start is not None else ""
    ye = body.year_end if body.year_end is not None else ""
    cache_key = (
        f"{_CACHE_KEY_PREFIX}min:{body.min_shared_papers}:max:{body.max_collaborators}"
        f":years:{ys}-{ye}:papers:{body.max_papers}:name:{name_key}"
    )

    cached = get_cached_historical_thread(db, cache_key)
    if cached:
        cached["cached"] = True
        return cached

    from services.researcher_network_service import build_coauthor_network
    result = build_coauthor_network(
        root_author_name=body.root_author_name,
        min_shared_papers=body.min_shared_papers,
        max_collaborators=body.max_collaborators,
        year_start=body.year_start,
        year_end=body.year_end,
        max_papers=body.max_papers,
    )

    if result.get("nodes"):
        save_historical_thread(db, topic=cache_key, data=result)

    result["cached"] = False
    return result

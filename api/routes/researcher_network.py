from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.schemas import ResearcherNetworkRequest
from services.database_service import (
    get_cached_historical_thread,
    save_historical_thread,
)
from utils.database import get_db

router = APIRouter()

_CACHE_KEY_PREFIX = "network::"


@router.post("/researcher-network")
def get_researcher_network(body: ResearcherNetworkRequest, db: Session = Depends(get_db)):
    cache_key = (
        f"{_CACHE_KEY_PREFIX}{body.root_author_name.strip().lower()}"
        f":min:{body.min_shared_papers}:max:{body.max_collaborators}"
        f":years:{body.year_start}-{body.year_end}:papers:{body.max_papers}"
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

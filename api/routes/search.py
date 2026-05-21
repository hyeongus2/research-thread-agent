from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.schemas import SearchRequest
from services import thread_service
from utils.database import get_db

router = APIRouter()


@router.post("/search")
def search(body: SearchRequest, db: Session = Depends(get_db)):
    return thread_service.create_research_thread(
        keyword=body.keyword,
        start_date=body.start_date,
        end_date=body.end_date,
        info_types=body.info_types,
        user_id=body.user_id,
        db=db,
    )


@router.get("/search/history")
def get_search_history(user_id: int, db: Session = Depends(get_db)):
    from models.thread import SearchHistory

    records = (
        db.query(SearchHistory)
        .filter(SearchHistory.user_id == user_id)
        .order_by(SearchHistory.searched_at.desc())
        .limit(20)
        .all()
    )
    return [
        {"id": r.id, "keyword": r.keyword, "searched_at": str(r.searched_at)}
        for r in records
    ]

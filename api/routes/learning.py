from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.schemas import LearningPathRequest
from utils.database import get_db

router = APIRouter()


@router.post("/learning-path")
def learning_path(body: LearningPathRequest, db: Session = Depends(get_db)):
    # Phase 3: wire up historical_thread_service.build_learning_path()
    return {"message": "Coming in Phase 3", "topic": body.topic}

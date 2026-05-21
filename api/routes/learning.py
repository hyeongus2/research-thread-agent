from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.schemas import LearningPathRequest
from services import historical_thread_service
from utils.database import get_db

router = APIRouter()


@router.post("/learning-path")
def learning_path(body: LearningPathRequest, db: Session = Depends(get_db)):
    return historical_thread_service.build_learning_path(topic=body.topic, db=db)

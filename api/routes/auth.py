import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.schemas import OnboardingRequest, OnboardingResponse, UserResponse
from services.database_service import (
    add_subscription,
    get_or_create_user,
)
from utils.database import get_db

router = APIRouter()


@router.post("/onboarding", response_model=OnboardingResponse)
def complete_onboarding(body: OnboardingRequest, db: Session = Depends(get_db)):
    user = get_or_create_user(db, username="local_user")
    user.preferences = json.dumps({
        "categories": body.categories,
        "keywords": body.keywords,
    })
    db.commit()
    db.refresh(user)

    for category in body.categories:
        add_subscription(db, user_id=user.id, topic=category)

    return OnboardingResponse(user_id=user.id, username=user.username)


@router.get("/me", response_model=UserResponse)
def get_me(user_id: int, db: Session = Depends(get_db)):
    from models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    prefs = json.loads(user.preferences) if user.preferences else None
    return UserResponse(user_id=user.id, username=user.username, preferences=prefs)

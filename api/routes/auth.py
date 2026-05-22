import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.schemas import OnboardingRequest, OnboardingResponse, UserResponse
from models.subscription import Subscription
from services.database_service import (
    add_subscription,
    get_or_create_user,
)
from utils.database import get_db

router = APIRouter()


class PreferencesUpdate(BaseModel):
    categories: list[str]
    keywords: list[str]


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


@router.patch("/me/preferences")
def update_preferences(user_id: int, body: PreferencesUpdate, db: Session = Depends(get_db)):
    from models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.preferences = json.dumps({
        "categories": body.categories,
        "keywords": body.keywords,
    })

    # Sync subscriptions: deactivate all, re-add selected categories
    db.query(Subscription).filter(Subscription.user_id == user_id).update({"is_active": False})
    db.commit()
    for category in body.categories:
        add_subscription(db, user_id=user_id, topic=category)

    db.commit()
    db.refresh(user)
    # Invalidate my-feed cache so the next fetch returns fresh data
    from api.routes.feed import _myfeed_cache
    _myfeed_cache.pop(user_id, None)
    return {"ok": True}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.schemas import SubscriptionCreate, SubscriptionResponse
from services.database_service import (
    add_subscription,
    deactivate_subscription,
    get_active_subscriptions,
)
from utils.database import get_db

router = APIRouter()


@router.get("/subscriptions", response_model=list[SubscriptionResponse])
def list_subscriptions(user_id: int, db: Session = Depends(get_db)):
    subs = get_active_subscriptions(db, user_id)
    return [
        SubscriptionResponse(
            id=s.id,
            topic=s.topic,
            is_active=s.is_active,
            created_at=str(s.created_at),
        )
        for s in subs
    ]


@router.post("/subscriptions", response_model=SubscriptionResponse)
def create_subscription(body: SubscriptionCreate, db: Session = Depends(get_db)):
    sub = add_subscription(db, user_id=body.user_id, topic=body.topic)
    return SubscriptionResponse(
        id=sub.id,
        topic=sub.topic,
        is_active=sub.is_active,
        created_at=str(sub.created_at),
    )


@router.delete("/subscriptions/{subscription_id}")
def delete_subscription(
    subscription_id: int, user_id: int, db: Session = Depends(get_db)
):
    success = deactivate_subscription(db, subscription_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return {"ok": True}

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.schemas import NotificationResponse
from services.database_service import get_unread_notifications, mark_notification_read
from utils.database import get_db

router = APIRouter()


@router.get("/notifications", response_model=list[NotificationResponse])
def list_notifications(user_id: int, db: Session = Depends(get_db)):
    notifs = get_unread_notifications(db, user_id)
    return [
        NotificationResponse(
            id=n.id,
            title=n.title,
            content=n.content,
            info_type=n.info_type,
            topic=n.topic,
            source_url=n.source_url,
            is_read=n.is_read,
            created_at=str(n.created_at),
        )
        for n in notifs
    ]


@router.patch("/notifications/{notification_id}/read")
def read_notification(
    notification_id: int, user_id: int, db: Session = Depends(get_db)
):
    success = mark_notification_read(db, notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}

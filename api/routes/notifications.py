import json
import queue
import threading
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from api.schemas import NotificationResponse, NotificationSettingsUpdate
from models.notification import Notification
from models.settings import NotificationSettings
from services.database_service import mark_notification_read
from utils.database import SessionLocal, get_db

router = APIRouter()


def _to_response(n: Notification) -> NotificationResponse:
    # Append "Z" so JavaScript parses as UTC, not local time
    ts = n.created_at.strftime('%Y-%m-%dT%H:%M:%SZ') if n.created_at else ""
    return NotificationResponse(
        id=n.id,
        title=n.title,
        content=n.content,
        info_type=n.info_type,
        topic=n.topic,
        source_url=n.source_url,
        is_read=n.is_read,
        created_at=ts,
    )


@router.get("/notifications", response_model=list[NotificationResponse])
def list_notifications(user_id: int, db: Session = Depends(get_db)):
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [_to_response(n) for n in notifs]


@router.get("/notifications/count")
def get_unread_count(user_id: int, db: Session = Depends(get_db)):
    count = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .count()
    )
    return {"unread": count}


@router.patch("/notifications/{notification_id}/read")
def read_notification(
    notification_id: int, user_id: int, db: Session = Depends(get_db)
):
    success = mark_notification_read(db, notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@router.post("/notifications/read-all")
def read_all_notifications(user_id: int, db: Session = Depends(get_db)):
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .all()
    )
    now = datetime.utcnow()
    for n in updated:
        n.is_read = True
        n.read_at = now
    db.commit()
    return {"ok": True, "marked": len(updated)}


@router.get("/notifications/settings")
def get_notification_settings(user_id: int, db: Session = Depends(get_db)):
    s = db.query(NotificationSettings).filter(NotificationSettings.user_id == user_id).first()
    if not s:
        return {"email_enabled": True, "breakthrough_enabled": False}
    return {
        "email_enabled": s.email_enabled,
        "breakthrough_enabled": s.breakthrough_enabled,
    }


@router.patch("/notifications/settings")
def update_notification_settings(
    user_id: int, body: NotificationSettingsUpdate, db: Session = Depends(get_db)
):
    s = db.query(NotificationSettings).filter(NotificationSettings.user_id == user_id).first()
    if not s:
        s = NotificationSettings(
            user_id=user_id,
            email_enabled=body.email_enabled if body.email_enabled is not None else True,
            breakthrough_enabled=body.breakthrough_enabled or False,
        )
        db.add(s)
    else:
        if body.email_enabled is not None:
            s.email_enabled = body.email_enabled
        if body.breakthrough_enabled is not None:
            s.breakthrough_enabled = body.breakthrough_enabled
        s.updated_at = datetime.utcnow()
    db.commit()
    return {
        "ok": True,
        "email_enabled": s.email_enabled,
        "breakthrough_enabled": s.breakthrough_enabled,
    }


def _run_check_sync():
    from services.notification_service import check_and_notify
    from api.routes.feed import _myfeed_cache
    db = SessionLocal()
    try:
        check_and_notify(db)
        _myfeed_cache.clear()
    finally:
        db.close()


@router.post("/notifications/check")
async def trigger_check(background_tasks: BackgroundTasks):
    """Manually trigger the notification check (runs in background thread)."""
    background_tasks.add_task(_run_check_sync)
    return {"ok": True, "message": "Notification check started"}


@router.get("/notifications/check/stream")
def check_stream(user_id: int):
    """SSE: run notification check for a single user, streaming progress events."""
    event_q: queue.Queue = queue.Queue()

    def run() -> None:
        from services.notification_service import check_and_notify_for_user
        from api.routes.feed import _myfeed_cache
        db = SessionLocal()
        try:
            def progress_cb(event):
                event_q.put(event)

            check_and_notify_for_user(db, user_id, progress_cb)
            _myfeed_cache.pop(user_id, None)
        except Exception as exc:
            event_q.put({"stage": "error", "msg": str(exc)})
        finally:
            db.close()
            event_q.put(None)  # sentinel

    threading.Thread(target=run, daemon=True).start()

    def generate():
        while True:
            item = event_q.get()
            if item is None:
                break
            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

import json
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from config.settings import settings
from models.notification import Notification
from models.settings import NotificationSettings
from models.subscription import Subscription
from models.thread import HistoricalThread, SearchHistory
from models.user import User


def get_or_create_user(db: Session, username: str, email: Optional[str] = None) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(username=username, email=email)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_active_subscriptions(db: Session, user_id: int) -> list[Subscription]:
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.is_active.is_(True))
        .all()
    )


def add_subscription(db: Session, user_id: int, topic: str) -> Subscription:
    existing = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.topic == topic,
            Subscription.is_active.is_(True),
        )
        .first()
    )
    if existing:
        return existing
    sub = Subscription(user_id=user_id, topic=topic)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def deactivate_subscription(db: Session, subscription_id: int, user_id: int) -> bool:
    sub = (
        db.query(Subscription)
        .filter(Subscription.id == subscription_id, Subscription.user_id == user_id)
        .first()
    )
    if not sub:
        return False
    sub.is_active = False
    db.commit()
    return True


def get_unread_notifications(db: Session, user_id: int) -> list[Notification]:
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .order_by(Notification.created_at.desc())
        .all()
    )


def mark_notification_read(db: Session, notification_id: int, user_id: int) -> bool:
    notif = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notif:
        return False
    notif.is_read = True
    notif.read_at = datetime.utcnow()
    db.commit()
    return True


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    content: str,
    info_type: str,
    topic: str,
    source_url: str,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        title=title,
        content=content,
        info_type=info_type,
        topic=topic,
        source_url=source_url,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif


def save_search_history(
    db: Session,
    user_id: int,
    keyword: str,
    thread_results: dict,
    date_range_start: Optional[str] = None,
    date_range_end: Optional[str] = None,
    info_types: Optional[list[str]] = None,
) -> SearchHistory:
    cutoff = datetime.utcnow() - timedelta(days=30)
    db.query(SearchHistory).filter(SearchHistory.searched_at < cutoff).delete()
    db.commit()

    record = SearchHistory(
        user_id=user_id,
        keyword=keyword,
        date_range_start=date_range_start,
        date_range_end=date_range_end,
        info_types=json.dumps(info_types or []),
        thread_results=json.dumps(thread_results),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def clear_search_history(db: Session) -> int:
    deleted = db.query(SearchHistory).delete()
    db.commit()
    return deleted


def get_cached_historical_thread(db: Session, topic: str) -> Optional[dict]:
    record = db.query(HistoricalThread).filter(HistoricalThread.topic == topic).first()
    if not record:
        return None
    cache_expiry = record.updated_at + timedelta(days=settings.LEARNING_PATH_CACHE_DAYS)
    if datetime.utcnow() > cache_expiry:
        return None
    return json.loads(record.data) if record.data else None


def save_historical_thread(
    db: Session,
    topic: str,
    data: dict,
    year_range: Optional[str] = None,
) -> HistoricalThread:
    record = db.query(HistoricalThread).filter(HistoricalThread.topic == topic).first()
    if record:
        record.data = json.dumps(data)
        record.year_range = year_range
        record.updated_at = datetime.utcnow()
    else:
        record = HistoricalThread(topic=topic, year_range=year_range, data=json.dumps(data))
        db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_or_create_notification_settings(
    db: Session, user_id: int
) -> NotificationSettings:
    ns = (
        db.query(NotificationSettings)
        .filter(NotificationSettings.user_id == user_id)
        .first()
    )
    if not ns:
        ns = NotificationSettings(user_id=user_id)
        db.add(ns)
        db.commit()
        db.refresh(ns)
    return ns


def update_notification_settings(
    db: Session, user_id: int, **kwargs
) -> NotificationSettings:
    ns = get_or_create_notification_settings(db, user_id)
    for key, value in kwargs.items():
        if hasattr(ns, key):
            setattr(ns, key, value)
    ns.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ns)
    return ns

from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from utils.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    preferences: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string: {"categories": [...], "keywords": [...]}
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    subscriptions: Mapped[list] = relationship("Subscription", back_populates="user")
    notifications: Mapped[list] = relationship("Notification", back_populates="user")
    notification_settings: Mapped[Optional[object]] = relationship(
        "NotificationSettings", back_populates="user", uselist=False
    )
    search_history: Mapped[list] = relationship("SearchHistory", back_populates="user")

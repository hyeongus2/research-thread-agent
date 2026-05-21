from datetime import datetime
from sqlalchemy import Integer, Boolean, String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from utils.database import Base


class NotificationSettings(Base):
    __tablename__ = "notification_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), unique=True, nullable=False
    )
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    email_frequency: Mapped[str] = mapped_column(String, default="daily")
    email_time: Mapped[str] = mapped_column(String, default="09:00")
    notify_paper: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_model: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_repo: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[object] = relationship("User", back_populates="notification_settings")

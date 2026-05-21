from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from utils.database import Base


class SearchHistory(Base):
    __tablename__ = "search_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    keyword: Mapped[str] = mapped_column(String, nullable=False)
    date_range_start: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    date_range_end: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    info_types: Mapped[Optional[str]] = mapped_column(Text, nullable=True)    # JSON array
    thread_results: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # JSON blob
    searched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped[object] = relationship("User", back_populates="search_history")


class HistoricalThread(Base):
    __tablename__ = "historical_threads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    topic: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    year_range: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)           # JSON blob
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

from datetime import date
from typing import Optional

from pydantic import BaseModel


# ── Auth ──────────────────────────────────────────────────────────────────────

class CalibrationItem(BaseModel):
    paper_id: int
    liked: bool


class OnboardingRequest(BaseModel):
    categories: list[str]
    keywords: list[str]
    calibration: list[CalibrationItem] = []


class OnboardingResponse(BaseModel):
    user_id: int
    username: str


class UserResponse(BaseModel):
    user_id: int
    username: str
    preferences: Optional[dict] = None


# ── Search ────────────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    keyword: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    info_types: list[str] = ["paper", "model", "repo"]
    user_id: int


class SearchHistoryItem(BaseModel):
    id: int
    keyword: str
    searched_at: str


# ── Learning Path ─────────────────────────────────────────────────────────────

class LearningPathRequest(BaseModel):
    topic: str
    user_id: int


# ── Subscriptions ─────────────────────────────────────────────────────────────

class SubscriptionCreate(BaseModel):
    topic: str
    user_id: int


class SubscriptionResponse(BaseModel):
    id: int
    topic: str
    is_active: bool
    created_at: str


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationResponse(BaseModel):
    id: int
    title: str
    content: Optional[str] = None
    info_type: Optional[str] = None
    topic: Optional[str] = None
    source_url: Optional[str] = None
    is_read: bool
    created_at: str

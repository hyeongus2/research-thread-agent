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
    user_id: int
    paper_limit: int = 50
    model_limit: int = 25
    repo_limit: int = 25


class SummarizePaperRequest(BaseModel):
    abstract: str
    lang: str = "en"


class SummarizeOverviewRequest(BaseModel):
    keyword: str
    paper_titles: list[str] = []
    lang: str = "en"


class SearchHistoryItem(BaseModel):
    id: int
    keyword: str
    searched_at: str


# ── Learning Path ─────────────────────────────────────────────────────────────

class LearningPathRequest(BaseModel):
    topic: str
    user_id: int
    lang: str = "en"
    papers_per_era: int = 10
    models_count: int = 5
    repos_count: int = 5


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


class NotificationSettingsUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    breakthrough_enabled: Optional[bool] = None

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


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
    papers: list[dict] = []
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


class CitationGraphRequest(BaseModel):
    query: str
    max_seed_papers: int = 5
    max_depth: int = 1
    min_citations: int = 0


class ResearcherNetworkRequest(BaseModel):
    root_author_name: str
    min_shared_papers: int = Field(default=2, ge=1, le=50)
    max_collaborators: int = Field(default=20, ge=1, le=50)
    year_start: Optional[int] = Field(default=None, ge=1900, le=2100)
    year_end: Optional[int] = Field(default=None, ge=1900, le=2100)
    max_papers: int = Field(default=100, ge=1, le=200)

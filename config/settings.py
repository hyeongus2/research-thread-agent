import os
from dotenv import load_dotenv

load_dotenv()

AVAILABLE_CLAUDE_MODELS: list[dict] = [
    {"id": "claude-haiku-4-5-20251001", "label": "Haiku 4.5 — fast, lowest cost"},
    {"id": "claude-sonnet-4-6",         "label": "Sonnet 4.6 — balanced (default)"},
    {"id": "claude-opus-4-7",           "label": "Opus 4.7 — most capable, highest cost"},
]

_DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6"


class Settings:
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "")
    HF_API_TOKEN: str = os.getenv("HF_API_TOKEN", "")
    SEMANTIC_SCHOLAR_API_KEY: str = os.getenv("SEMANTIC_SCHOLAR_API_KEY", "")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    USER_EMAIL: str = os.getenv("USER_EMAIL", "")

    DATABASE_URL: str = "sqlite:///data/research_thread.db"

    _raw_model = os.getenv("CLAUDE_MODEL", _DEFAULT_CLAUDE_MODEL)
    CLAUDE_MODEL: str = _raw_model if _raw_model in [m["id"] for m in AVAILABLE_CLAUDE_MODELS] else _DEFAULT_CLAUDE_MODEL

    # arXiv allows max 3 requests/second; 0.34s delay keeps us safely under
    ARXIV_RATE_LIMIT_DELAY: float = 0.34

    # Re-generate a Learning Path only if the cached version is older than this
    LEARNING_PATH_CACHE_DAYS: int = 90


settings = Settings()

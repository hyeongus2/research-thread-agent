import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "")
    HF_API_TOKEN: str = os.getenv("HF_API_TOKEN", "")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    USER_EMAIL: str = os.getenv("USER_EMAIL", "")

    DATABASE_URL: str = "sqlite:///data/research_thread.db"
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"

    # arXiv allows max 3 requests/second; 0.34s delay keeps us safely under
    ARXIV_RATE_LIMIT_DELAY: float = 0.34

    # Re-generate a Learning Path only if the cached version is older than this
    LEARNING_PATH_CACHE_DAYS: int = 7


settings = Settings()

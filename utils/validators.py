from datetime import date
from typing import Optional

from fastapi import HTTPException, Request


def require_localhost(request: Request) -> None:
    """Dependency: allow only requests originating from localhost."""
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1"):
        raise HTTPException(status_code=403, detail="This endpoint is only accessible from localhost.")


def validate_date_range(
    start: Optional[date], end: Optional[date]
) -> tuple[Optional[date], Optional[date]]:
    """Swap start/end if reversed so callers don't need to handle that case."""
    if start and end and start > end:
        return end, start
    return start, end


def validate_keyword(keyword: str) -> str:
    keyword = keyword.strip()
    if not keyword:
        raise ValueError("Keyword cannot be empty")
    return keyword


def validate_topic(topic: str) -> str:
    topic = topic.strip()
    if not topic:
        raise ValueError("Topic cannot be empty")
    if len(topic) > 200:
        raise ValueError("Topic must be 200 characters or fewer")
    return topic

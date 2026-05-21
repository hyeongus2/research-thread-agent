from datetime import date
from typing import Optional


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

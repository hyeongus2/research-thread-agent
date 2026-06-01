"""APScheduler background job: daily notification check."""

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from utils.database import SessionLocal
from services.notification_service import check_and_notify

logger = logging.getLogger(__name__)

_scheduler = BackgroundScheduler()


def start_scheduler() -> None:
    if _scheduler.running:
        return
    _scheduler.add_job(
        _run_check, "interval", hours=24, id="daily_notify", replace_existing=True
    )
    _scheduler.start()
    logger.info("Scheduler started: daily_notify every 24h")


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def _run_check() -> None:
    db = SessionLocal()
    try:
        check_and_notify(db)
    except Exception as exc:
        logger.error("daily_notify job failed: %s", exc)
    finally:
        db.close()

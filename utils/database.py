import os
from collections.abc import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase

os.makedirs("data", exist_ok=True)

DATABASE_URL = "sqlite:///data/research_thread.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    # Import all models so their tables are registered with Base.metadata
    from models import user, subscription, notification, thread, settings  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Add columns introduced after initial schema creation (SQLite ALTER TABLE is limited)
    with engine.connect() as conn:
        try:
            conn.execute(
                __import__("sqlalchemy").text(
                    "ALTER TABLE notifications ADD COLUMN citation_count INTEGER DEFAULT 0"
                )
            )
            conn.commit()
        except Exception:
            pass  # column already exists
        try:
            conn.execute(
                __import__("sqlalchemy").text(
                    "ALTER TABLE notification_settings ADD COLUMN breakthrough_enabled BOOLEAN DEFAULT 0"
                )
            )
            conn.commit()
        except Exception:
            pass  # column already exists

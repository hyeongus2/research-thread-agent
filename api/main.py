from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from api.routes import auth, learning, notifications, search, subscriptions
from utils.database import Base, engine, get_db, init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Research Thread Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(learning.router, prefix="/api")
app.include_router(subscriptions.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")


@app.post("/api/admin/reset-db")
async def reset_db():
    # Import all models so Base.metadata knows every table before drop_all
    from models import user, subscription, notification, thread, settings  # noqa: F401
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return {"message": "Database reset successfully"}


@app.post("/api/admin/clear-search-history")
async def clear_search_history_endpoint(db: Session = Depends(get_db)):
    from services.database_service import clear_search_history
    deleted = clear_search_history(db)
    return {"deleted": deleted}

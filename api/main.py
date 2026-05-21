from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import auth, learning, notifications, search, subscriptions
from utils.database import init_db


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

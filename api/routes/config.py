"""Config endpoints: read/write .env keys and select Claude model."""

import os
from pathlib import Path

from dotenv import set_key
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config.settings import AVAILABLE_CLAUDE_MODELS, settings

router = APIRouter()

_ENV_PATH = Path(__file__).parent.parent.parent / ".env"

_SECRET_KEYS = {"ANTHROPIC_API_KEY", "GITHUB_TOKEN", "HF_API_TOKEN", "SEMANTIC_SCHOLAR_API_KEY", "RESEND_API_KEY"}
_ALL_KEYS = list(_SECRET_KEYS) + ["USER_EMAIL"]


class EnvUpdateRequest(BaseModel):
    updates: dict[str, str]


class ModelUpdateRequest(BaseModel):
    model: str


@router.get("/config/env-status")
def get_env_status():
    """Return which keys are set. Secret key values are never returned."""
    status = {}
    for key in _SECRET_KEYS:
        status[key] = bool(os.getenv(key, ""))
    status["USER_EMAIL"] = os.getenv("USER_EMAIL", "")
    return status


@router.post("/config/env")
def update_env(body: EnvUpdateRequest):
    """Write one or more .env values. Only recognised keys are accepted."""
    if not _ENV_PATH.exists():
        _ENV_PATH.touch()

    unknown = set(body.updates) - set(_ALL_KEYS)
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown keys: {unknown}")

    for key, value in body.updates.items():
        if value == "":
            continue
        set_key(str(_ENV_PATH), key, value)
        os.environ[key] = value
        _apply_to_settings(key, value)

    return {"ok": True}


@router.get("/config/models")
def get_models():
    """Return available Claude models and the currently selected one."""
    return {
        "available": AVAILABLE_CLAUDE_MODELS,
        "current": settings.CLAUDE_MODEL,
    }


@router.post("/config/model")
def update_model(body: ModelUpdateRequest):
    """Persist the selected Claude model to .env and apply it immediately."""
    valid_ids = [m["id"] for m in AVAILABLE_CLAUDE_MODELS]
    if body.model not in valid_ids:
        raise HTTPException(status_code=400, detail=f"Unknown model: {body.model}")

    if not _ENV_PATH.exists():
        _ENV_PATH.touch()

    set_key(str(_ENV_PATH), "CLAUDE_MODEL", body.model)
    os.environ["CLAUDE_MODEL"] = body.model
    settings.CLAUDE_MODEL = body.model
    return {"ok": True, "model": body.model}


def _apply_to_settings(key: str, value: str) -> None:
    """Mirror a newly written .env value into the live settings object."""
    _map = {
        "ANTHROPIC_API_KEY":      "ANTHROPIC_API_KEY",
        "GITHUB_TOKEN":           "GITHUB_TOKEN",
        "HF_API_TOKEN":           "HF_API_TOKEN",
        "SEMANTIC_SCHOLAR_API_KEY": "SEMANTIC_SCHOLAR_API_KEY",
        "RESEND_API_KEY":         "RESEND_API_KEY",
        "USER_EMAIL":             "USER_EMAIL",
    }
    attr = _map.get(key)
    if attr:
        setattr(settings, attr, value)

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from api.routes import config


class LocalConfigTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(config.router, prefix="/api")
        self.tmp = tempfile.TemporaryDirectory()
        self.env_path = Path(self.tmp.name) / ".env"
        self.env_patch = patch.object(config, "_ENV_PATH", self.env_path)
        self.env_patch.start()

    def tearDown(self):
        self.env_patch.stop()
        self.tmp.cleanup()

    def test_remote_model_write_is_denied(self):
        with TestClient(self.app, client=("203.0.113.1", 1234)) as client:
            response = client.post("/api/config/model", json={"model": config.AVAILABLE_CLAUDE_MODELS[0]["id"]})
        self.assertEqual(response.status_code, 403)
        self.assertFalse(self.env_path.exists())

    def test_local_model_write_updates_only_temporary_env(self):
        model = config.AVAILABLE_CLAUDE_MODELS[0]["id"]
        with patch.dict(os.environ), patch.object(config.settings, "CLAUDE_MODEL", model):
            with TestClient(self.app, client=("127.0.0.1", 1234)) as client:
                response = client.post("/api/config/model", json={"model": model})
        self.assertEqual(response.status_code, 200)
        self.assertIn(model, self.env_path.read_text())

    def test_invalid_env_update_creates_no_file(self):
        with TestClient(self.app, client=("::1", 1234)) as client:
            response = client.post("/api/config/env", json={"updates": {"UNKNOWN": "example"}})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(self.env_path.exists())

    def test_database_path_is_project_relative(self):
        from utils.database import DATABASE_URL
        self.assertEqual(DATABASE_URL, "sqlite:///" + (Path(__file__).resolve().parents[1] / "data/research_thread.db").as_posix())


if __name__ == "__main__":
    unittest.main()

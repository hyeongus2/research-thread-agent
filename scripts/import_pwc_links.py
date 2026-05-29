"""One-time script: download PWC archive and import into paper_code_links table.

Usage:
    python scripts/import_pwc_links.py

Downloads links-between-papers-and-code.json from the paperswithcode-data
GitHub archive (~200 MB uncompressed), extracts arXiv IDs, and bulk-inserts
into the local SQLite database.

Re-running truncates and re-imports (idempotent).
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

# Allow running from repo root
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from utils.database import Base, SessionLocal, engine

_PWC_URL = (
    "https://raw.githubusercontent.com/paperswithcode/"
    "paperswithcode-data/master/links-between-papers-and-code.json"
)
_ARXIV_RE = re.compile(r"arxiv\.org/abs/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)", re.IGNORECASE)

BATCH_SIZE = 5000


def _extract_arxiv_id(paper_url: str) -> str:
    m = _ARXIV_RE.search(paper_url or "")
    return m.group(1).split("v")[0] if m else ""


def main():
    # Ensure table exists
    from models import paper_code  # noqa: F401
    Base.metadata.create_all(bind=engine)

    print(f"Downloading PWC links from GitHub archive…")
    print(f"URL: {_PWC_URL}")
    print("(This may take a minute — file is ~200 MB uncompressed)")

    try:
        with urllib.request.urlopen(_PWC_URL, timeout=120) as resp:
            raw = resp.read()
    except Exception as exc:
        print(f"Download failed: {exc}")
        sys.exit(1)

    print(f"Downloaded {len(raw) / 1_048_576:.1f} MB. Parsing…")
    data = json.loads(raw)
    print(f"Total link entries: {len(data):,}")

    db = SessionLocal()
    try:
        db.execute(text("DELETE FROM paper_code_links"))
        db.commit()

        inserted = 0
        batch = []
        for entry in data:
            arxiv_id = _extract_arxiv_id(entry.get("paper_url", ""))
            if not arxiv_id:
                continue
            repo_url = entry.get("repo_url", "")
            if not repo_url:
                continue
            batch.append({
                "arxiv_id": arxiv_id,
                "repo_url": repo_url,
                "is_official": bool(entry.get("is_official")),
                "stars": int(entry.get("stars") or 0),
            })
            if len(batch) >= BATCH_SIZE:
                db.execute(
                    text(
                        "INSERT INTO paper_code_links (arxiv_id, repo_url, is_official, stars) "
                        "VALUES (:arxiv_id, :repo_url, :is_official, :stars)"
                    ),
                    batch,
                )
                db.commit()
                inserted += len(batch)
                batch = []
                print(f"  Inserted {inserted:,}…", end="\r")

        if batch:
            db.execute(
                text(
                    "INSERT INTO paper_code_links (arxiv_id, repo_url, is_official, stars) "
                    "VALUES (:arxiv_id, :repo_url, :is_official, :stars)"
                ),
                batch,
            )
            db.commit()
            inserted += len(batch)

        print(f"\nDone. Inserted {inserted:,} code links.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

"""Reset the local SQLite database.

Deletes data/research_thread.db and recreates an empty schema.
Run this when you want a clean slate (new topic focus, test reset, etc.).

Usage:
    python scripts/reset_db.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "research_thread.db")


def main() -> None:
    if os.path.exists(DB_PATH):
        confirm = input(f"Delete {DB_PATH} and reset all data? [y/N] ").strip().lower()
        if confirm != "y":
            print("Aborted.")
            return
        os.remove(DB_PATH)
        print("Database deleted.")
    else:
        print("No database found — nothing to delete.")

    from utils.database import init_db
    init_db()
    print("Empty database created at", DB_PATH)


if __name__ == "__main__":
    main()

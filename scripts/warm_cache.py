"""Pre-warm the trending cache so first visitors see instant content.

Hits the local backend at http://localhost:8000:
  GET /api/feed/trending?period=daily|weekly|monthly  -- populates DB cache

Run this once after starting the backend (and ideally before opening the app
to visitors). Repeat hits are cheap because the backend caches results in the
local DB (same-day cache, survives restarts).
"""

import sys
import time

import requests

BASE = "http://localhost:8000/api"
TIMEOUT = 60
PERIODS = ["daily", "weekly", "monthly"]


def warm_trending(period: str) -> int:
    t0 = time.time()
    r = requests.get(f"{BASE}/feed/trending", params={"period": period}, timeout=TIMEOUT)
    r.raise_for_status()
    papers = r.json().get("papers", [])
    print(f"  {period:>7}: {len(papers)} papers ({time.time()-t0:.1f}s)", flush=True)
    return len(papers)


def main() -> int:
    print("Warming Research Thread Agent trending cache ...", flush=True)
    try:
        for period in PERIODS:
            warm_trending(period)
    except Exception as exc:
        print(f"ERROR: trending fetch failed: {exc}", flush=True)
        print("Is the backend running on port 8000?", flush=True)
        return 1
    print("Trending cache warmed.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

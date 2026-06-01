"""Pre-warm the trending and figure caches so first visitors see instant content.

Hits the local backend at http://localhost:8000:
  1. GET /api/feed/trending?period=monthly  -- populates trending cache
  2. For each paper with an arxiv_id, GET /api/figure/{id}  -- populates ar5iv cache

Run this once after starting the backend (and ideally before opening the app
to visitors). Repeat hits are cheap because the backend caches results.
"""

import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

BASE = "http://localhost:8000/api"
TIMEOUT = 30
FIGURE_WORKERS = 4  # match-ish the backend's ar5iv tolerance


def warm_trending() -> list[dict]:
    print(f"  fetching {BASE}/feed/trending?period=monthly ...", flush=True)
    t0 = time.time()
    r = requests.get(f"{BASE}/feed/trending", params={"period": "monthly"}, timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()
    papers = data.get("papers", [])
    print(f"  trending ready: {len(papers)} papers ({time.time()-t0:.1f}s)", flush=True)
    return papers


def warm_one_figure(arxiv_id: str) -> tuple[str, bool, float]:
    t0 = time.time()
    try:
        r = requests.get(f"{BASE}/figure/{arxiv_id}", timeout=TIMEOUT)
        r.raise_for_status()
        d = r.json()
        ok = bool(d.get("figure_url"))
    except Exception:
        ok = False
    return arxiv_id, ok, time.time() - t0


def warm_figures(papers: list[dict]) -> None:
    ids = [p["arxiv_id"] for p in papers if p.get("arxiv_id")]
    if not ids:
        print("  no arxiv_ids to warm.", flush=True)
        return
    print(f"  warming {len(ids)} figures (concurrency={FIGURE_WORKERS}) ...", flush=True)
    t0 = time.time()
    hits = 0
    misses = 0
    with ThreadPoolExecutor(max_workers=FIGURE_WORKERS) as ex:
        futures = [ex.submit(warm_one_figure, aid) for aid in ids]
        for i, fut in enumerate(as_completed(futures), 1):
            aid, ok, dt = fut.result()
            mark = "✓" if ok else "·"
            if ok:
                hits += 1
            else:
                misses += 1
            print(f"    [{i:>3}/{len(ids)}] {mark} {aid}  ({dt:.1f}s)", flush=True)
    elapsed = time.time() - t0
    print(f"  figures done: {hits} with image, {misses} fallback ({elapsed:.1f}s)", flush=True)


def main() -> int:
    print("Warming Research Thread Agent caches ...", flush=True)
    try:
        papers = warm_trending()
    except Exception as exc:
        print(f"ERROR: trending fetch failed: {exc}", flush=True)
        print("Is the backend running on port 8000?", flush=True)
        return 1

    if not papers:
        print("No papers returned. Skipping figure warming.", flush=True)
        return 0

    try:
        warm_figures(papers)
    except Exception as exc:
        print(f"WARNING: figure warming had issues: {exc}", flush=True)
        return 0

    print("All caches warmed.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())

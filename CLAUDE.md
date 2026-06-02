# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Research Thread Agent is a local-first, open-source AI/ML research curation tool. It collects papers, models, and repositories from Semantic Scholar, Hugging Face Hub, and GitHub, then presents them in seven views:

- **Quick Search**: Latest content feed for a user-specified time period
- **Learning Path**: Historical progression of a topic, organized chronologically by era
- **Research Lineage**: Citation-based graph showing relationships between papers
- **Researcher Network**: Coauthorship network built around a chosen PI/author from Semantic Scholar metadata
- **Trending Feed**: Community-upvoted papers from Hugging Face (daily / weekly / monthly)
- **My Feed**: Personalized paper alerts based on subscribed categories and keywords
- **Venues**: Browse papers from major ML/AI conferences by year

All data is stored locally in SQLite — no external server, no telemetry.

## Delivery Strategy: Two Versions

This project ships as two independent interfaces over the same service layer:

| Version | Interface | LLM cost | Who uses it |
|---|---|---|---|
| **Electron desktop app** | Native-feel app (.exe/.dmg) — click icon to open, no terminal needed | User's own Anthropic API credits | Users who want visual UI (Instagram-style feed) |
| **MCP server** | Claude.ai chat extension | Covered by Claude Pro subscription | Users who prefer chat interface |

Both versions call the same `services/` functions. The Electron app bundles FastAPI + Next.js and launches them automatically. The MCP server calls services directly as tools.

**Implementation order**: Next.js + FastAPI first (Phases 0–4), MCP server next (Phase 5), Electron packaging last (Phase 6).

**How Electron works**:
```
[Double-click app icon]
  → Electron main process starts
  → Spawns: uvicorn api.main:app --port 8000  (FastAPI, background)
  → Spawns: next start --port 3000            (Next.js, background)
  → Opens BrowserWindow loading http://localhost:3000
[Close window]
  → Electron kills both child processes → complete shutdown
```

During development (before packaging), run the two servers manually. Once packaged, the icon handles everything.

**Frontend source**: The `koi-prototype/` folder was the original reference prototype. Its design patterns have been fully absorbed into `frontend/` and the folder has been deleted.

## Implementation Status

| Area | Status | Files |
|---|---|---|
| DB schema + ORM models | **Done** | `models/`, `utils/database.py` |
| Semantic Scholar / HF / GitHub data collection | **Done** | `services/semantic_scholar_service.py`, `hf_service.py`, `github_service.py` |
| arXiv | **Deprecated** | `services/arxiv_service.py` — no longer used; can be deleted |
| DB CRUD operations | **Done** | `services/database_service.py` |
| FastAPI backend scaffold | **Done** | `api/main.py`, `api/routes/`, `api/schemas.py` |
| Next.js frontend + Onboarding | **Done** | `frontend/` — Welcome → categories → keywords (optional) → feed; `POST /api/onboarding` connected; calibration step removed |
| i18n (EN / 한국어) | **Done** | `frontend/app/i18n/en.js`, `ko.js`, `frontend/app/context/LanguageContext.jsx` — language toggle pinned globally via `LangToggle` in `page.jsx` |
| Quick Search | **Done (v0.11.0)** | Semantic Scholar + HF + GitHub; tabs; pagination; on-demand AI; configurable limits; BibTeX copy; Code links (PWC); Author mode (candidate list → paper list, date-filtered) |
| Admin reset endpoint | **Done** | `POST /api/admin/reset-db` in `api/main.py` — Settings reset button now works |
| Learning Path | **Done** | `services/historical_thread_service.py`, `api/routes/learning.py`, `frontend/app/components/LearningPath.jsx` |
| Trending Feed | **Done (v1.0.3)** | `services/hf_daily_service.py`, `api/routes/feed.py` — daily/weekly/monthly filter; DB-backed same-day cache (`trending:` in `historical_threads`); 2-column responsive grid |
| Research Lineage | **Done (v0.11.0)** | `services/citation_graph_service.py`, `api/routes/citation_graph.py`, `frontend/app/components/CitationGraph.jsx` — 2-call graph build (bulk search + batch refs); graph history; amber selected-node highlight; red arrows from influential nodes |
| Researcher Network | **Done** | `services/researcher_network_service.py`, `api/routes/researcher_network.py`, `frontend/app/components/ResearcherNetwork.jsx` — coauthorship network from SS author/paper metadata; radial SVG (root + two-ring collaborators), edge thickness ∝ shared papers; peer (collaborator↔collaborator) edges; heuristic relationship hints only (never verified mentor-trainee); always-visible warning; graph/collaborators/shared-papers tabs; route-level cache (`network::` prefix in `historical_threads`) |
| Venues tab | **Done (v0.10.0)** | `api/routes/venues.py` — browse papers by conference + year (NeurIPS, ICML, ICLR, CVPR, AAAI, ECCV, ACL, EMNLP · 2020–2025); in-memory cache (`_venues_cache`) |
| Subscriptions + In-App Notifications | **Done (v1.0.3)** | `services/notification_service.py`, `api/routes/notifications.py` — SSE-triggered daily check; DB-backed same-day guard (`mycheck::` in `historical_threads`); 30-day auto-cleanup; APScheduler removed |
| MCP server | **Done (v1.0.2)** | `mcp_server/server.py` — 6 tools: quick_search, learning_path, trending_papers, venue_papers, research_lineage, my_feed; stdio transport; Claude Desktop config documented |
| Activity notifications | **Done (v1.0.1)** | Client-side `localNotifs` in `Feed.jsx`; 6 features fire `addLocalNotif` on completion; bell badge = DB unread + local unread; clicking navigates to that tab; individual × delete + per-section "Delete all" button |
| Notification delete | **Done (v1.0.1)** | `DELETE /api/notifications/{id}` in `api/routes/notifications.py`; × button per item; "Delete all" text button per section header in `NotificationDropdown` |
| Electron desktop packaging | **Not started** | `electron/main.js`, `electron/package.json` |

## Development Commands

```bash
# --- First-time setup ---
./setup.sh        # Mac/Linux  (creates .venv, pip install, npm install)
setup.bat         # Windows

# --- Development mode ---
./run.sh          # Mac/Linux  (starts both servers in one terminal)
run.bat           # Windows    (opens two terminal windows)

# Manual alternative (two terminals):
#   Terminal 1: uvicorn api.main:app --reload --port 8000
#   Terminal 2: cd frontend && npm run dev
# App at http://localhost:3000 | API docs at http://localhost:8000/docs

# --- Reset local database ---
python scripts/reset_db.py

# --- Build for packaging ---
cd frontend && npm run build
cd electron && npm run package
# Output: electron/dist/Research-Thread-Agent-Setup.exe  (Windows)
#         electron/dist/Research-Thread-Agent.dmg         (Mac)
```

## Required Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...       # Required
GITHUB_TOKEN=ghp_...               # Required (>60 req/hour needs auth)
HF_API_TOKEN=hf_...                # Optional
RESEND_API_KEY=re_...              # Optional (email notifications)
USER_EMAIL=...                     # Optional (email notifications)
```

## Architecture

### Layer Overview

```
frontend/          ← Next.js 15 PWA (KOI-style UI)
    ↕ HTTP (fetch)
api/               ← FastAPI (Python, port 8000)
    ↕ direct call
services/          ← Pure Python business logic (no framework imports)
    ↕
models/ + SQLite   ← SQLAlchemy ORM + data/research_thread.db
```

### Frontend (`frontend/`)

Next.js 15 app, mobile-first PWA. Based on KOI prototype design patterns:
- Instagram-style paper feed with swipe/scroll
- Onboarding: category selection → keyword input → feed
- Screen state machine: welcome → categories → keywords → feed
- Design tokens from KOI: dark theme, card layout, modal overlays

| File/Dir | Purpose |
|---|---|
| `frontend/app/page.jsx` | Root — handles screen state, renders current view; `LangToggle` component pinned globally |
| `frontend/app/components/Onboarding.jsx` | 2-step onboarding (categories → keywords, optional) |
| `frontend/app/components/Feed.jsx` | Search bar with keyword chips, period filters, type toggles, result cards, loading progress, empty state |
| `frontend/app/components/PaperDetail.jsx` | Modal with full detail, links, HF resources |
| `frontend/app/components/Settings.jsx` | Notification prefs, DB reset |
| `frontend/app/i18n/` | EN + KO translation files |
| `frontend/app/context/LanguageContext.jsx` | Language state + `useLanguage()` hook |

**Onboarding flow**: welcome → categories (multi-select) → keywords (optional chips) → feed. Result POSTed to `/api/onboarding`; `user_id` stored in `localStorage`.

**Categories** (10): NLP/LLM, Computer Vision, Generative AI, AI Agents, Reinforcement Learning, Multimodal, Speech/Audio, Robotics, ML Theory, Systems/Efficiency

Note: RL and Agents are separate categories — RL covers algorithmic RL (deep RL, RLHF reward modeling), while Agents covers LLM-based agentic systems (tool use, planning, multi-agent).

**All UI text is managed via i18n.** Never hardcode UI strings directly in components — use `useLanguage()` and the translation keys in `frontend/app/i18n/`.

**i18n structure:**
- `frontend/app/i18n/en.js` — English strings
- `frontend/app/i18n/ko.js` — Korean strings
- `frontend/app/context/LanguageContext.jsx` — `LanguageProvider` + `useLanguage()` hook
- Language preference persisted in `localStorage('lang')`
- Toggle available on Welcome screen (top-right) and Settings screen

When adding new UI strings: add to both `en.js` and `ko.js`, then use `const { t } = useLanguage()` in the component.

### Backend API (`api/`)

FastAPI app. Thin layer — validates requests, calls services, returns JSON. No business logic here.

```
api/
├── main.py              # FastAPI app, CORS (allow localhost:3000), lifespan startup
├── schemas.py           # Pydantic request/response models
└── routes/
    ├── auth.py          # POST /onboarding, GET /me
    ├── search.py        # POST /search, GET /search/history
    ├── learning.py      # POST /learning-path
    ├── subscriptions.py # CRUD /subscriptions
    └── notifications.py # GET /notifications, PATCH /notifications/{id}/read
```

CORS must allow `http://localhost:3000` (Next.js dev server).

### Services Layer (`services/`)

Pure Python — no FastAPI or Streamlit imports. Routes call services; services never call routes.

| Service | Responsibility |
|---|---|
| `semantic_scholar_service.py` | **New** — Semantic Scholar API; papers for Quick Search sorted by citation count |
| `arxiv_service.py` | **Deprecated** — no longer used; both Quick Search and Learning Path now use Semantic Scholar |
| `hf_service.py` | Hugging Face Hub API — models sorted by downloads |
| `github_service.py` | GitHub REST API — repos sorted by stars; 5000 req/hour with token |
| `claude_service.py` | On-demand summaries only — `generate_overview()` and `summarize_paper()`; batch `score_relevance()` **removed** |
| `rag_service.py` | **Deprecated / to delete** — ChromaDB RAG no longer used in Quick Search |
| `thread_service.py` | Orchestrates Quick Search: fetch concurrently → return sorted results; no embed/rank step |
| `historical_thread_service.py` | Orchestrates Learning Path: arXiv → group by era → per-era Claude summary |
| `notification_service.py` | Creates Notification records; `check_and_notify_for_user()` called by SSE endpoint |
| `database_service.py` | SQLAlchemy CRUD operations |
| `scheduler_service.py` | **Removed** — APScheduler removed; My Feed refresh is SSE-triggered with DB-backed daily guard |

### Data Flow

**Quick Search (v0.5.0 — new architecture):**
```
POST /search {keyword, date_filter, page, per_page}
  → [semantic_scholar_service, hf_service, github_service] called concurrently
  → Results already sorted by quality signal (citation count / downloads / stars)
  → No ChromaDB, no batch LLM scoring
  → thread_service: assemble Thread dict {papers[], models[], repos[]}
  → return JSON → Next.js renders three separate tabs
  → save to search_history table

LLM usage (on-demand only, not part of search flow):
  POST /api/summarize/overview {keyword, papers[]}  → Claude overview text (streaming)
  POST /api/summarize/paper    {abstract}            → Claude one-line summary (streaming)
```

**Learning Path:**
```
POST /learning-path {topic}
  → check historical_threads table (cache hit → return immediately)
  → semantic_scholar_service: fetch 100 papers for topic (all years, citation-sorted)
  → group by publication year into era buckets
  → claude_service: per-era summary + explanation
  → hf_service + github_service: resources per era
  → save to historical_threads table (TTL: 1 week)
  → return JSON → Next.js renders era tabs
```

**Background scheduler (hourly):**
```
For each active subscription:
  → fetch last 1 hour from arXiv/HF/GitHub
  → claude_service: is it relevant to the subscribed topic?
  → if yes: insert into notifications table
  → if user.notification_settings.email_enabled: send via Resend
```

### Models (`models/`)

SQLAlchemy ORM models mapping to the SQLite schema below. `utils/database.py` holds the engine and session factory.

## SQLite Schema

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    preferences JSON,            -- {"categories": [...], "keywords": [...], "lang": "en"|"ko"}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    topic TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT,
    info_type TEXT,          -- 'paper' | 'model' | 'repo'
    topic TEXT,
    source_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at);

CREATE TABLE notification_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    in_app_enabled BOOLEAN DEFAULT TRUE,
    email_enabled BOOLEAN DEFAULT TRUE,
    email_frequency TEXT DEFAULT 'daily',   -- 'daily' | 'weekly' | 'monthly'
    email_time TEXT DEFAULT '09:00',
    notify_paper BOOLEAN DEFAULT TRUE,
    notify_model BOOLEAN DEFAULT TRUE,
    notify_repo BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    keyword TEXT NOT NULL,
    date_range_start DATE,
    date_range_end DATE,
    info_types TEXT,         -- JSON array: ["paper","model","repo"]
    thread_results TEXT,     -- JSON blob of the full Thread object
    searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE historical_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL UNIQUE,
    year_range TEXT,
    data JSON,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Key Implementation Constraints

- **Semantic Scholar rate limit**: 100 req/5 min without API key (1 search = 1–3 req); key gives 1 req/sec. Key is optional but recommended.
- **arXiv**: no longer used — both Quick Search and Learning Path use Semantic Scholar (+ OpenAlex fallback)
- **GitHub rate limit**: 5000 req/hour authenticated, 60 unauthenticated — always require `GITHUB_TOKEN`
- **Learning Path cache**: re-generate only if `updated_at` is older than 7 days
- **Claude model**: use `claude-sonnet-4-6` for on-demand summaries only
- **Claude usage in Quick Search**: never call Claude automatically on search; only when user clicks "✦ AI Overview" or "✦ AI 요약" button
- **All links**: render as `<a href={url} target="_blank">` in Next.js — never plain text
- **ChromaDB / RAG**: do not add new RAG usage; `rag_service.py` is deprecated and can be deleted
- **`historical_threads` as key-value store**: reused for multiple same-day caches beyond Learning Path — `trending:daily/weekly/monthly` (trending feed), `mycheck::{user_id}` (My Feed daily guard), `citation::{topic}` (Research Lineage), `network::{topic}` (Researcher Network). Filter these prefixes out of LP history queries.
- **Language persistence**: `lang` stored in `users.preferences` JSON via `PATCH /api/me/lang`; also mirrored to `localStorage`. On mount, `localStorage` checked first; if missing, DB fallback via `GET /api/me?user_id=1`.
- **Onboarding recovery**: if `localStorage` `user_id` missing, `page.jsx` calls `GET /api/me?user_id=1` — if user exists in DB, skips onboarding. Handles Chrome incognito / clear-on-exit scenarios.

## Phase Implementation Guides

### Phase 0: FastAPI Backend Scaffold ✓ Complete

`api/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import auth, search, learning, subscriptions, notifications

app = FastAPI(title="Research Thread Agent API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(learning.router, prefix="/api")
app.include_router(subscriptions.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
```

Add `fastapi` and `uvicorn[standard]` to `requirements.txt`.

---

### Phase 1: Onboarding Flow ✓ Complete

**Backend** — `api/routes/auth.py`:
```python
@router.post("/onboarding")
def complete_onboarding(body: OnboardingRequest, db: Session = Depends(get_db)):
    # Create user record with preferences JSON
    # Auto-create subscriptions for each selected category
    # Return {user_id, username}
```

**Frontend** — `frontend/app/components/Onboarding.jsx` (adapt from `koi-prototype/app/components/Onboarding.jsx`):
- Step 1: Category checkboxes (NLP/LLM, Vision, RL/Agent, Theory/ML, Robotics, Speech/Audio, Multimodal, Systems)
- Step 2: Keyword input + chip display; suggested defaults as clickable chips
- Step 3: Confirmation summary → "Start" calls `POST /api/onboarding`

**State**: `frontend/app/page.jsx` — check `localStorage.getItem("user_id")` on mount. If null, show Onboarding; else show Feed.

---

### Phase 2: Quick Search ✓ Complete (v0.3–v0.4) — needs rewrite in v0.5.0

Original implementation shipped and working. See v0.5.0 spec below for the planned major rewrite.

---

### Phase 3: Learning Path ✓ Complete

Built in v0.4.0. arXiv (Relevance sort, 100 papers) → era grouping → Claude summaries → HF/GitHub fetched once at topic level and shared across eras. Era buckets: Before 2018 / 2018–2020 / 2021–2022 / 2023–2024 / 2025–2026 / … (2-year pairs; single-year final bucket when current year is odd). 7-day SQLite cache.

---

### Phase 4: Notifications, Subscriptions & Trending Feed

**Notifications/Subscriptions** — same as original plan:

`services/notification_service.py` — `check_and_notify(db)`, `send_email_digest(user_email, notifications)`
`services/scheduler_service.py` — APScheduler `start_scheduler()` wired into FastAPI lifespan
`api/routes/subscriptions.py` — CRUD `/subscriptions`
`api/routes/notifications.py` — `GET /notifications`, `PATCH /notifications/{id}/read`

**Trending Feed (HF Daily Papers)** — ✅ Done (v0.6.0–v0.7.1):
- `services/hf_daily_service.py` — `fetch_papers_range(days)` fetches N days in parallel, deduplicates by arxiv_id
- `api/routes/feed.py` — `GET /api/feed/trending?period=daily|weekly|monthly`
- Frontend: `TrendingFeed` + `TrendingCard` components in `Feed.jsx`; daily/weekly/monthly period pills; per-card summary expand/collapse

---

### Phase 5: MCP Server

The MCP server exposes the same service functions as tools that Claude.ai can invoke during chat.

**Directory**: `mcp_server/`

**Dependency**: `pip install mcp` (add to requirements.txt when implementing)

`mcp_server/server.py`:
```python
from mcp.server import FastMCP
from services.thread_service import create_research_thread
from services.historical_thread_service import build_learning_path

mcp = FastMCP("Research Thread Agent")

@mcp.tool()
def quick_search(keyword: str, period: str = "last_month") -> dict:
    """Search arXiv, Hugging Face, and GitHub for recent content on a topic."""
    ...

@mcp.tool()
def learning_path(topic: str) -> dict:
    """Build a historical learning path for a research topic, era by era."""
    ...

if __name__ == "__main__":
    mcp.run()
```

**Key constraint**: MCP tools must return JSON-serializable dicts/lists — no SQLAlchemy model objects.

---

### Phase 6: Electron Desktop Packaging

Wraps FastAPI + Next.js into a single clickable desktop app. No terminal required after packaging.

**Directory**: `electron/` (separate Node project, sibling to `frontend/`)

**Dependencies** (`electron/package.json`):
```json
{
  "scripts": {
    "start": "electron .",
    "package": "electron-builder"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.0.0"
  },
  "build": {
    "appId": "com.research-thread-agent",
    "productName": "Research Thread Agent",
    "files": ["main.js"],
    "extraResources": [
      {"from": "../", "to": "app", "filter": ["**/*", "!koi-prototype", "!*.venv", "!electron"]}
    ],
    "win":   {"target": "nsis"},
    "mac":   {"target": "dmg"},
    "linux": {"target": "AppImage"}
  }
}
```

**`electron/main.js`** — core logic:
```javascript
const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let fastapiProc, nextProc, win;
const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.join(__dirname, '..');

function startServers() {
  // Start FastAPI
  fastapiProc = spawn('python', ['-m', 'uvicorn', 'api.main:app', '--port', '8000'], {
    cwd: APP_ROOT, env: { ...process.env }
  });

  // Start Next.js (must have run `next build` first)
  nextProc = spawn('node', ['node_modules/.bin/next', 'start', '--port', '3000'], {
    cwd: path.join(APP_ROOT, 'frontend')
  });
}

function createWindow() {
  win = new BrowserWindow({ width: 1200, height: 800, webPreferences: { nodeIntegration: false } });
  // Wait for Next.js to be ready, then load
  setTimeout(() => win.loadURL('http://localhost:3000'), 3000);
}

app.whenReady().then(() => { startServers(); createWindow(); });

app.on('before-quit', () => {
  if (fastapiProc) fastapiProc.kill();
  if (nextProc) nextProc.kill();
});
```

**Key constraint**: `next build` must be run before packaging. The packaged app runs `next start` (production mode), not `next dev`.

**Python in packaged app**: On the user's machine, Python must be installed and in PATH. For full standalone distribution (no Python required), use PyInstaller to bundle the FastAPI server as an `.exe` first — this is out of scope for hackathon.

---

## Code Standards

- Python 3.9+, PEP 8, type hints on all function signatures
- Docstrings: Google format, English only
- Comments: only for non-obvious logic (rate limits, workarounds) — never restate what the code does
- No Korean, emoji, or markdown formatting inside `.py` files
- snake_case for Python; camelCase for JS/JSX
- Frontend component files: PascalCase (e.g. `PaperCard.jsx`)

### Commit convention
```
feat:     new feature
fix:      bug fix
refactor: no behavior change
docs:     documentation only
test:     tests only
chore:    dependencies, tooling
```
Example: `feat: add arxiv paper collection with rate limiting`

**All commit messages and README/documentation must be written in English. No Korean in commit messages or docs.**

---

## Current State & Next Steps (as of v0.10.0)

**Phases 0–4 are complete.** App runs end-to-end: onboarding → trending feed → My Feed → search (Quick Search / Learning Path / Research Lineage) → venues → notifications.

### What works now
- **Trending Feed**: HF Daily Papers with daily / weekly / monthly period filter (parallel multi-day fetch, deduplicated)
  - Fetches use UTC date — avoids empty results for UTC+ahead timezones (e.g. KST)
  - DB-backed same-day cache (`trending:daily/weekly/monthly` in `historical_threads`); survives server restarts
  - 2-column responsive grid (≥768px), 1-column on mobile; each card has expand/collapse for summary text
- **My Feed**: personalized paper alerts from subscribed categories + keywords
  - SSE-triggered daily check; DB-backed same-day guard (`mycheck::{user_id}` in `historical_threads`) — survives server restarts; no APScheduler
  - SSE real-time generation progress; papers sorted by citation count
  - Bell icon shows unread count badge (DB paper alerts + client-side activity notifications combined); dropdown: mark single/all as read, source link opens in new tab
  - Badge updates immediately on read and after SSE check completes — no 60 s polling lag
  - Auto-generates after onboarding; re-generates (clears old notifications + mycheck record) when Settings interests are saved
  - Notifications older than 30 days auto-deleted at start of each daily SSE refresh
- **4-tab nav**: Trending | My Feed | Search | Venues
- **Quick Search**: keyword chips, 6 period filters, type tabs (Papers/Models/Repos), pagination, abstract toggle
  - History dropdown on input focus with per-item delete; auto-expires after 30 days
  - AI Summary button shows inline hint when ANTHROPIC_API_KEY is absent (no silent failure, retries work)
  - Result limits configurable in Settings
  - BibTeX copy button ("Cite") on every paper card; Code link button when PWC data available
  - **Author mode** (v0.11.0): Topic/Author toggle; Author mode shows candidate list (name, paper count, citation count); selecting an author loads their papers sorted by citation count; date period filter applied client-side; caches candidates by query and papers by author ID; Settings paper limit applies
- **Learning Path**: integrated into Search tab via Quick Search ↔ Learning Path ↔ Research Lineage ↔ Researcher Network toggle
  - Era tab strip scrollable with mouse wheel; horizontal scroll no longer leaks to page scroll at edges
  - Papers / Models / Repos tabs per era
  - Paper card abstract toggle (bottom bar with border-top separator)
  - History list in idle state, click to reload from cache, per-item delete; cache TTL 90 days
  - Per-era sequential date-filtered fetch with 1.5s delay; configurable limits in Settings
  - Per-paper AI analysis (Problem / Solution / Significance / Limitations), language-aware
- **Research Lineage**: citation-based graph in Search tab (3rd mode) — **rebuilt in v0.11.0**
  - **2 API calls total**: bulk search (top 100 papers) + `POST /paper/batch` for reference IDs; edges built from intersection within the 100-paper set; build time ~3 s (was 30–60 s)
  - `AI_FIELDS_OF_STUDY` constant shared across Quick Search, Learning Path, and Research Lineage
  - SVG graph, year-based left→right layout; top-5 by citation = Influential (red), rest = Related (blue)
  - Red arrows = edges originating from Influential nodes; node click shows PaperCard with AI Summary button
  - Selected node highlighted in amber; connected nodes in dark; dimmed nodes at 12% opacity
  - History list in idle state (like Learning Path); click to reload from cache; per-item delete
  - "All Results" fallback tab lists all nodes
- **Researcher Network**: coauthorship network in Search tab (4th mode)
  - Input is a PI/author name (not a topic); filters: min shared papers, max collaborators, year range
  - Backend resolves the author via SS, aggregates coauthors from the root's papers; peer edges (collaborator↔collaborator within the root's papers) built without extra API calls
  - Radial SVG: root at center, collaborators on a staggered two-ring layout; edge thickness ∝ shared papers; dashed amber edge = heuristic `possible_mentor_trainee_pattern` hint only
  - Relationship hints are heuristic signals, never verified relationships; an "coauthorship does not imply advisor-student" warning is always visible and repeated per edge
  - Tabs: graph / collaborators / shared-papers; click a node or list row to open a side panel
  - Route-level cache (`network::` prefix in `historical_threads`); response carries `cached` flag → "⚡ cached result"
  - In-memory frontend cache (`cacheRef`, keyed by name + filters) — re-running the same query renders instantly with no fetch/loading until the tab is closed
  - Search-history dropdown on input focus (like Research Lineage): `GET/DELETE /api/researcher-network/history` reads/removes `network::` keys; click an item to reload (name + filters), per-item delete
- **Venues tab**: browse papers by major ML/AI conference + year
  - NeurIPS, ICML, ICLR, CVPR, AAAI, ECCV, ACL, EMNLP · 2020–2025
- **Activity notifications** (v1.0.1): client-side ephemeral notifications for all feature completions
  - Each of Quick Search, Learning Path, Research Lineage, Researcher Network, Trending, My Feed, Venues fires `addLocalNotif` when done
  - Bell dropdown shows "RECENT ACTIVITY" section (local) above "PAPER ALERTS" section (DB)
  - Clicking an activity notification navigates to the relevant tab and marks it read
  - × button per item; "Delete all" text button per section header
  - `DELETE /api/notifications/{id}` endpoint for permanent DB alert removal
  - Bell badge = sum of unread DB alerts + unread activity notifications
- **Back button behavior** (v1.0.1): "Back" in Learning Path / Research Lineage results returns to each component's own idle screen (not Quick Search)
- **Semantic Scholar rate limiting**: global `threading.Semaphore(1)` + 1 s inter-request gap minimises 429s and OpenAlex fallback
- **LAN support**: uvicorn binds to `0.0.0.0`; frontend API URL hostname-dynamic; sensitive endpoints localhost-only
- **Settings**: API keys and Claude model selectable in-app (saved to `.env`); interests editor with immediate feed check
- Multi-keyword AND semantics across all sources
- SSE streaming progress for both Quick Search and Learning Path
- Language toggle EN/KO, Settings → clear history / reset DB

### Known issues / config requirements
- User must set valid `GITHUB_TOKEN` in `.env` (or via Settings → API Keys)
- `ANTHROPIC_API_KEY` required for AI Overview, paper summaries, and Learning Path era analysis
- Code link button requires one-time PWC archive import: `python scripts/import_pwc_links.py` (~200 MB download)

---

## Next: Phase 4 Step 5 — In-App Notifications

**Design decisions (already settled):**
- Subscriptions = onboarding preferences. The user's `preferences` JSON (`{"categories": [...], "keywords": [...]}`) already stores what they care about. No separate subscription UI is needed.
- In-app notifications only. Email (Resend) is deferred.
- Notifications are generated by a background scheduler that runs once a day (not hourly — Semantic Scholar date-filtering is by publication date, daily granularity is sufficient).
- Bell icon in the header (already rendered in `Feed.jsx`) → click opens a notification dropdown with unread count badge.

### Files to create

**`services/notification_service.py`**
```python
"""Check user subscriptions and create Notification records for new papers."""

from datetime import date, timedelta
from sqlalchemy.orm import Session
from models.user import User, Notification
from services import semantic_scholar_service

CATEGORY_QUERIES = {
    "NLP/LLM":           "large language model NLP",
    "Computer Vision":   "computer vision image recognition",
    "Generative AI":     "generative AI diffusion",
    "AI Agents":         "LLM agent tool use",
    "Reinforcement Learning": "reinforcement learning",
    "Multimodal":        "multimodal vision language",
    "Speech/Audio":      "speech audio recognition",
    "Robotics":          "robotics manipulation",
    "ML Theory":         "machine learning theory optimization",
    "Systems/Efficiency": "model efficiency quantization",
}

def check_and_notify(db: Session) -> None:
    """Fetch new papers for each user's subscriptions; insert Notification rows."""
    users = db.query(User).all()
    today = date.today()
    since = (today - timedelta(days=1)).isoformat()

    for user in users:
        prefs = user.preferences or {}
        queries = []
        for cat in prefs.get("categories", []):
            q = CATEGORY_QUERIES.get(cat)
            if q:
                queries.append(q)
        for kw in prefs.get("keywords", []):
            queries.append(kw)

        seen_urls = {
            n.source_url
            for n in db.query(Notification).filter(Notification.user_id == user.id).all()
        }

        for query in queries:
            papers = semantic_scholar_service.search_papers(query, limit=10, start_date=since)
            for p in papers:
                url = p.get("url") or p.get("pdf_url")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                notif = Notification(
                    user_id=user.id,
                    title=p.get("title", ""),
                    content=(p.get("abstract") or "")[:400],
                    info_type="paper",
                    topic=query,
                    source_url=url,
                )
                db.add(notif)
        db.commit()
```

**`services/scheduler_service.py`**
```python
"""APScheduler background job: daily notification check."""

from apscheduler.schedulers.background import BackgroundScheduler
from utils.database import SessionLocal
from services.notification_service import check_and_notify

_scheduler = BackgroundScheduler()

def start_scheduler() -> None:
    if _scheduler.running:
        return
    _scheduler.add_job(
        _run_check, "interval", hours=24, id="daily_notify", replace_existing=True
    )
    _scheduler.start()

def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)

def _run_check() -> None:
    db = SessionLocal()
    try:
        check_and_notify(db)
    finally:
        db.close()
```

Wire into `api/main.py` lifespan:
```python
from services.scheduler_service import start_scheduler, stop_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()
```
(The lifespan context manager is already in `api/main.py` — just add the two calls.)

Add `apscheduler` to `requirements.txt`.

### API endpoints to implement

**`api/routes/notifications.py`** (stub already exists — fill it in):

```python
GET  /api/notifications?user_id=1         → list NotificationResponse[], ordered by created_at desc, limit 50
GET  /api/notifications/count?user_id=1   → {"unread": N}   ← new endpoint for bell badge
PATCH /api/notifications/{id}/read        → mark single notification as read
POST  /api/notifications/read-all?user_id=1 → mark all as read for user  ← new
```

**`api/schemas.py`** — `NotificationResponse` already defined; add nothing new.

### Frontend changes

**`frontend/app/components/Feed.jsx`** — bell icon is already rendered in the header (line ~799). Tasks:

1. **Poll unread count** on mount and every 60s:
   ```js
   const [unreadCount, setUnreadCount] = useState(0);
   useEffect(() => {
     const fetchCount = async () => {
       const res = await fetch(`${API}/notifications/count?user_id=${userId || 1}`);
       const d = await res.json();
       setUnreadCount(d.unread || 0);
     };
     fetchCount();
     const id = setInterval(fetchCount, 60000);
     return () => clearInterval(id);
   }, [userId]);
   ```

2. **Bell badge**: wrap the `<Bell>` in a `<div style={{ position: 'relative' }}>` and show a red dot/count when `unreadCount > 0`.

3. **Notification dropdown**: `const [showNotifs, setShowNotifs] = useState(false)` — clicking bell toggles it. Render as a new `NotificationDropdown` component (similar to `SearchHistoryDropdown` pattern):
   - Fetch `GET /api/notifications?user_id=1` on open
   - List cards: title (truncated), topic badge, relative time, link icon
   - Clicking a notification marks it read + opens source_url in new tab
   - "Mark all read" button at top
   - Close on outside click

4. **i18n keys** to add (in both `en.js` and `ko.js`):
   ```js
   notifications: {
     title: 'Notifications',          // 알림
     markAllRead: 'Mark all read',    // 모두 읽음
     empty: 'No new notifications.',  // 새 알림이 없어요.
     viewSource: 'View paper',        // 논문 보기
   }
   ```

### Implementation order
1. `services/notification_service.py` + `scheduler_service.py`
2. Wire scheduler into `api/main.py` lifespan; add `apscheduler` to `requirements.txt`
3. Fill in `api/routes/notifications.py` (GET list, GET count, PATCH read, POST read-all)
4. Frontend: bell badge + `NotificationDropdown` component in `Feed.jsx`
5. Add i18n keys

### What NOT to build (deferred)
- Email digest via Resend — `RESEND_API_KEY` is in `.env` but email sending is out of scope for now
- Separate subscription management UI — onboarding preferences are the subscriptions
- My Feed tab content — that stub stays as "coming soon"

---

## v0.5.0 — Quick Search Major Rewrite Spec

**Goal**: Replace arXiv + RAG + batch LLM scoring with Semantic Scholar + quality-signal sorting + on-demand AI. Make results significantly faster and more voluminous.

### What changes

| | v0.4.0 (current) | v0.5.0 (target) |
|---|---|---|
| Paper source | arXiv (3 req/sec delay, ~20 papers) | Semantic Scholar (1 req, 100 papers) |
| Paper ranking | Claude relevance score | Citation count (API-sorted) |
| Model ranking | Claude relevance score | Downloads (API-sorted) |
| Repo ranking | Claude relevance score | Stars (API-sorted) |
| RAG/ChromaDB | Yes (`rag_service.py`) | Removed |
| LLM on search | Automatic (every search) | On-demand button only |
| Result limits | 15 per type (max 45) | 100 papers / 50 models / 50 repos |
| Tab display | Mixed list, client-side filter | 3 fully separate tabs (Papers / Models / Repos) |
| Pagination | None | Page numbers with 10 / 25 / 50 per-page selector |
| Abstract on card | Not shown | 2-line truncated + inline "Show more" toggle |
| Scroll navigation | None | ↑ Top / ↓ Bottom buttons in each tab and feed |

### Semantic Scholar API

```
GET https://api.semanticscholar.org/graph/v1/paper/search
  ?query=<keyword>
  &limit=100
  &fields=title,authors,year,citationCount,venue,externalIds,abstract,openAccessPdf
  &sort=citationCount:desc
```
- No API key required for 100 req/5 min (sufficient for normal usage)
- `openAccessPdf.url` → direct PDF link
- `externalIds.ArXiv` → link to arXiv page if available
- `venue` → conference/journal name (NeurIPS, ICML, ICLR, etc.)
- Date filtering: `&year=2023-` (from 2023 onward) or `&publicationDateOrYear=2024-01-01:`

### On-demand LLM endpoints

```python
# New endpoints in api/routes/search.py

POST /api/summarize/overview
  body: {keyword: str, paper_titles: list[str]}
  → SSE stream of Claude-generated 2-3 sentence overview

POST /api/summarize/paper
  body: {abstract: str}
  → SSE stream of Claude-generated one-line summary
```

Frontend: "✦ AI Overview" button at top of search results; "✦ AI 요약" button on each paper card. If `ANTHROPIC_API_KEY` missing → show ".env에 키를 추가하세요" inline.

### Scroll navigation buttons

Every scrollable area (Papers tab, Models tab, Repos tab, Feed) has:
- **↑ 맨 위로** button — fixed position bottom-right, scrolls container to top
- **↓ 맨 아래로** button — scrolls to bottom of content (for feed: scrolls to the "더보기" / load more area)

Both buttons visible only when content is scrollable (hide at extremes optionally).

### Files to create / modify

**New:**
- `services/semantic_scholar_service.py` — `search_papers(keyword, limit, date_filter) -> list[dict]`

**Modify:**
- `services/thread_service.py` — replace arXiv + RAG with Semantic Scholar; remove `score_relevance` call
- `services/claude_service.py` — remove `score_relevance()`; keep `generate_overview()` and add `summarize_paper()`
- `api/routes/search.py` — add `POST /summarize/overview` and `POST /summarize/paper` SSE endpoints
- `api/schemas.py` — update `SearchRequest` (remove `info_types`; tabs are always all three); add `SummarizeRequest`
- `frontend/app/components/Feed.jsx` — tabs, pagination, abstract toggle, scroll buttons, on-demand AI buttons
- `frontend/app/i18n/en.js` + `ko.js` — new string keys for pagination, abstract toggle, AI buttons

**Delete:**
- `services/rag_service.py` — ChromaDB no longer used

### Thread dict structure (v0.5.0)

```json
{
  "keyword": "RAG evaluation",
  "papers":  [{"title": "", "authors": [], "abstract": "", "url": "", "pdf_url": "",
               "published_date": "2024-01-15", "citation_count": 312, "venue": "NeurIPS"}],
  "models":  [{"name": "", "downloads": 0, "likes": 0, "url": "", "pipeline_tag": ""}],
  "repos":   [{"name": "", "description": "", "stars": 0, "url": "", "language": ""}],
  "generated_at": "2026-05-22T12:00:00"
}
```

No `overview` or `summary` fields — those are generated on-demand via separate endpoints.

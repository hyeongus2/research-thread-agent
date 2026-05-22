# Research Thread Agent

A local-first, open-source research curation tool for AI/ML researchers and developers.

Automatically collects papers, models, and repositories from **Semantic Scholar**, **Hugging Face Hub**, and **GitHub**, then presents them in two modes:

- **Quick Search** — Papers, models, and repos for a keyword, sorted by quality signal (citations / downloads / stars)
- **Learning Path** — Historical development of a topic, organized chronologically by era
- **Trending Feed** — Community-upvoted papers from Hugging Face (daily or weekly)

All data is stored on your local machine (SQLite). No external server, no account required, no telemetry.

---

## Two Ways to Use

| | Desktop App | MCP Server |
|---|---|---|
| **Interface** | Native app — double-click to open, no terminal needed | Claude.ai chat extension |
| **AI cost** | Your own Anthropic API credits | Covered by Claude Pro subscription |
| **Best for** | Visual feed (Instagram-style) | Chat-style queries in Claude |

Both interfaces run on the same backend. The desktop app bundles FastAPI + Next.js and launches them automatically. The MCP server exposes the same logic as tools Claude can call during chat.

> **Current status**: Next.js + FastAPI interface is available now (run with `run.bat` / `run.sh`). Electron packaging and MCP server are on the roadmap.

---

## Features

### Quick Search
Search across three sources simultaneously with a single keyword:
- **Papers** tab — Semantic Scholar: up to 100 papers sorted by citation count
- **Models** tab — Hugging Face Hub: up to 50 models sorted by downloads
- **Repos** tab — GitHub: up to 50 repositories sorted by stars
- Filter by date range (past week / month / 3 months / all time)
- Page number navigation with 10 / 25 / 50 results per page
- Inline abstract expand / collapse on paper cards
- **✦ AI Overview** button — generates a 2-sentence topic overview on demand (requires Anthropic API key)
- **✦ AI Summary** button per paper — one-sentence summary on demand (requires Anthropic API key)
- Every result includes a clickable link to the original source

### Learning Path
Enter any research topic (e.g., *Retrieval-Augmented Generation*) and get:
- Key papers grouped into chronological eras (Before 2018 / 2018–2020 / 2021–2022 / 2023–2024 / 2025–2026 / …)
- Papers sourced from Semantic Scholar (citation-sorted), same as Quick Search
- Claude-generated summary of what changed in each era
- Hugging Face models and GitHub repos relevant to the topic
- Results cached for 7 days so repeat lookups are instant

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 18 (mobile-first PWA) |
| Backend | FastAPI + uvicorn (Python, port 8000) |
| AI | Claude API (`claude-sonnet-4-6`) — on-demand only |
| Data sources | Semantic Scholar API (+ OpenAlex fallback), Hugging Face Hub API, GitHub REST API |
| Storage | SQLite via SQLAlchemy |
| Scheduler | APScheduler |

---

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- A [GitHub personal access token](https://github.com/settings/tokens) (free, no special scopes needed)
- An [Anthropic API key](https://console.anthropic.com) (optional — only needed for AI Overview / AI Summary buttons and Learning Path era summaries)

> **Note on Anthropic API billing**: The API is billed separately from a Claude.ai Pro subscription. All data collection (Semantic Scholar, Hugging Face, GitHub) works without an API key — the key is only needed when you click the AI summary buttons.

### Installation

**Windows:**
```bat
git clone https://github.com/hyeongus2/research-thread-agent.git
cd research-thread-agent
setup.bat
```

**Mac / Linux:**
```bash
git clone https://github.com/hyeongus2/research-thread-agent.git
cd research-thread-agent
chmod +x setup.sh && ./setup.sh
```

`setup` automatically creates a `.venv` virtual environment, installs all Python and Node dependencies, and copies `.env.example` → `.env` on first run.

### Configuration

Open the generated `.env` file and fill in your keys:

```
ANTHROPIC_API_KEY=sk-ant-...      # optional — enables AI summary buttons
GITHUB_TOKEN=ghp_...              # required
HF_API_TOKEN=hf_...               # optional
SEMANTIC_SCHOLAR_API_KEY=         # optional — raises SS rate limit
```

### Run

**Windows:**
```bat
run.bat
```

**Mac / Linux:**
```bash
./run.sh
```

- Frontend (app): [http://localhost:3000](http://localhost:3000)
- Backend API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

> The app runs entirely on your local machine. There is no cost for keeping it running.

---

## Data & Storage

All data is stored in `data/research_thread.db` (SQLite, auto-created on first run, excluded from git).

- **Search history** accumulates over time — this is intentional.
- **Learning Path** results are cached for 90 days, then regenerated on next request.
- To start fresh: go to **Settings → Reset Database**, or run `python scripts/reset_db.py`.

---

## Project Structure

```
research-thread-agent/
├── setup.bat / setup.sh               # One-command setup (venv + npm install)
├── run.bat / run.sh                   # Start both servers
├── frontend/                          # Next.js 15 app (port 3000)
│   └── app/
│       ├── page.jsx                   # Root state machine (welcome → onboarding → feed)
│       └── components/                # Feed, LearningPath, Onboarding, Settings
├── api/                               # FastAPI backend (port 8000)
│   ├── main.py                        # App entry point, CORS, lifespan
│   ├── schemas.py                     # Pydantic request/response models
│   └── routes/                        # auth, search, learning, subscriptions, notifications
├── services/                          # Pure Python business logic
│   ├── semantic_scholar_service.py    # Semantic Scholar paper search (citation-sorted); OpenAlex fallback
│   ├── hf_service.py                  # HF Hub model search (download-sorted)
│   ├── github_service.py              # GitHub repo search (star-sorted)
│   ├── claude_service.py              # On-demand AI summaries (overview + per-paper)
│   ├── thread_service.py              # Quick Search orchestration
│   └── historical_thread_service.py   # Learning Path orchestration
├── models/                            # SQLAlchemy ORM models
├── scripts/                           # Utility scripts
│   └── reset_db.py                    # Wipe and reinitialize the database
└── utils/                             # DB connection, logging, validators
```

---

## API Rate Limits

| Source | Limit | Handling |
|---|---|---|
| Semantic Scholar | 100 req/5 min (no key) · 1 req/sec (with key) | Single request returns up to 100 papers |
| GitHub | 5,000 req/hour (authenticated) | Requires `GITHUB_TOKEN` |
| Hugging Face | Higher with token | `HF_API_TOKEN` recommended |
| OpenAlex | 10 req/sec | Automatic fallback when Semantic Scholar is rate-limited |
| Claude API | Per-token billing | On-demand only — never called automatically |

---

## Roadmap

### v0.7.1 (current)
- [x] Trending Feed: monthly period filter added (30-day parallel fetch, deduplicated)
- [x] Trending Feed: each card now has inline expand/collapse for the summary text (same pattern as Quick Search)
- [x] Quick Search: AI Summary no-key hint fix — empty-string guard removed so retries work; hint text now fills available space
- [x] Learning Path: era tab horizontal scroll no longer leaks to page scroll at left/right edges (non-passive native wheel listener)
- [x] Learning Path: paper card abstract toggle unified to Quick Search style — separated bottom bar with border-top, underline-button style removed

### v0.7.0
- [x] Trending Feed: daily / weekly period filter (fetches multiple days in parallel, deduplicated by arXiv ID)
- [x] Learning Path: Papers / Models / Repos tabs per era — no more scrolling to the bottom to see repos
- [x] Learning Path: era tab strip scrollable with mouse wheel
- [x] Quick Search: AI Summary button correctly shows "add API key" hint when ANTHROPIC_API_KEY is absent

### v0.6.0
- [x] 3-tab navigation: Trending | My Feed | Search
- [x] Learning Path integrated into Search tab as a Quick Search ↔ Learning Path toggle
- [x] Quick Search: history dropdown on search bar focus, per-item delete
- [x] Learning Path: history list in idle state, click to reload from cache, per-item delete
- [x] HF Daily Papers trending feed on the Trending tab
- [x] Learning Path cache TTL raised from 7 days → 90 days

### v0.5.4
- [x] Quick Search: search history auto-expires after 30 days (purged on each new search)
- [x] Settings: "Clear search history" button — removes Quick Search records while keeping preferences and Learning Path cache

### v0.5.3
- [x] Learning Path: topic title shown in results and loading screens
- [x] Learning Path: abstract expand/collapse on paper cards (same as Quick Search)
- [x] Learning Path: per-paper API key prompt when ANTHROPIC_API_KEY not set
- [x] Learning Path: sequential era fetching with delay — fixes rate-limit gaps in recent eras

### v0.5.2
- [x] Learning Path: per-era date-filtered queries — each era fetches its own papers by date range so recent eras (2025) are populated equally regardless of citation count
- [x] Learning Path: configurable papers-per-era in Settings (3–20, default 10)

### v0.5.1
- [x] Learning Path: per-paper AI analysis (Problem / Solution / Significance / Limitations)
- [x] Learning Path: real-time SSE progress display (sources found, era-by-era analysis status)
- [x] Learning Path: configurable limits in Settings (papers per era, models, repos)
- [x] Language-aware AI responses — Overview, Summary, and Learning Path era analysis respect the current UI language (EN / KO)
- [x] Multi-keyword AND semantics across Semantic Scholar, Hugging Face, and GitHub
- [x] OpenAlex fallback label shown dynamically in Quick Search progress badges

### v0.5.0
- [x] Quick Search: Semantic Scholar replaces arXiv as paper source (citation-count sorting)
- [x] Learning Path: Semantic Scholar replaces arXiv (consistent source across both modes)
- [x] OpenAlex automatic fallback when Semantic Scholar is rate-limited (no arXiv dependency)
- [x] Papers / Models / Repos fully separated into tabs (not mixed list)
- [x] Page number pagination with 10 / 25 / 50 per-page selector
- [x] Paper cards: inline abstract expand/collapse, citation count + venue badge
- [x] AI Overview and AI Summary on-demand buttons (no automatic LLM calls)
- [x] ChromaDB / RAG removed — no longer needed
- [x] Batch LLM relevance scoring removed — API quality signals replace it
- [x] Scroll-to-top / scroll-to-bottom buttons in all scrollable areas
- [x] Result limits raised: 100 papers / 50 models / 50 repos

### v0.4.0
- [x] Learning Path: era-based historical view of any research topic
- [x] Era bucketing: Before 2018 / 2018–2020 / 2021–2022 then 2-year pairs; odd current year gets a single-year final bucket
- [x] Claude-generated per-era summaries + topic overview; graceful fallback without API key
- [x] Learning Path results cached in SQLite for 7 days — instant on repeat lookups
- [x] HF models + GitHub repos fetched once at topic level and shown in each era tab

### v0.3.x
- [x] Quick Search: keyword chips, 6 period filters, SSE streaming progress
- [x] Per-source completion badges and error banners (rate-limit countdown, auth error, timeout)
- [x] Language toggle (EN / 한국어) pinned globally
- [x] Settings → Reset Database

### Upcoming
- [ ] Phase 4: Subscriptions, in-app notifications, email digest (bell icon → dropdown)
- [ ] Phase 5: Electron desktop packaging (no terminal required)
- [ ] Phase 6: MCP server for Claude.ai chat integration

---

## License

MIT — see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

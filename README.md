# Research Thread Agent

A local-first, open-source research curation tool for AI/ML researchers and developers.

Automatically collects papers, models, and repositories from **arXiv**, **Hugging Face Hub**, and **GitHub**, then presents them in two modes:

- **Quick Search** — Latest content feed for a keyword and time period you specify
- **Learning Path** — Historical development of a topic, organized chronologically by era

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
- Filter by date range (past week / month / 3 months / all time)
- Filter by content type (papers / models / repos)
- Claude-powered relevance scoring and one-sentence summaries
- Claude-generated overview of the research landscape for your query
- Every result includes a clickable link to the original source

### Learning Path
Enter any research topic (e.g., *Retrieval-Augmented Generation*) and get:
- Key papers grouped into chronological eras (Before 2018 / 2018–2020 / 2021–2022 / 2023–2024 / 2025–2026 / …)
- Claude-generated summary of what changed in each era
- Hugging Face models and GitHub repos relevant to the topic
- Results cached for 7 days so repeat lookups are instant

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 18 (mobile-first PWA) |
| Backend | FastAPI + uvicorn (Python, port 8000) |
| AI | Claude API (`claude-sonnet-4-20250514`) |
| Vector search | ChromaDB |
| Data sources | arXiv API, Hugging Face Hub API, GitHub REST API |
| Storage | SQLite via SQLAlchemy |
| Scheduler | APScheduler |

---

## Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+
- A [GitHub personal access token](https://github.com/settings/tokens) (free, no special scopes needed)
- An [Anthropic API key](https://console.anthropic.com) (required for AI features in Quick Search / Learning Path)

> **Note on Anthropic API billing**: The API is billed separately from a Claude.ai Pro subscription. Data collection (arXiv, Hugging Face, GitHub) works without an API key — the key is only needed when AI summarization features are implemented.

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
ANTHROPIC_API_KEY=sk-ant-...   # required for AI features
GITHUB_TOKEN=ghp_...           # required
HF_API_TOKEN=hf_...            # optional
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
- **Learning Path** results are cached for 7 days, then regenerated on next request.
- To start fresh: go to **Settings → Reset Database**, or run `python scripts/reset_db.py`.

---

## Project Structure

```
research-thread-agent/
├── setup.bat / setup.sh      # One-command setup (venv + npm install)
├── run.bat / run.sh          # Start both servers
├── frontend/                 # Next.js 15 app (port 3000)
│   └── app/
│       ├── page.jsx          # Root state machine (welcome → onboarding → feed)
│       └── components/       # Welcome, Onboarding, Feed, PaperDetail, Settings
├── api/                      # FastAPI backend (port 8000)
│   ├── main.py               # App entry point, CORS, lifespan
│   ├── schemas.py            # Pydantic request/response models
│   └── routes/               # auth, search, learning, subscriptions, notifications
├── services/                 # Pure Python business logic
│   ├── arxiv_service.py
│   ├── hf_service.py
│   ├── github_service.py
│   ├── claude_service.py     # (Phase 2)
│   ├── thread_service.py     # (Phase 2)
│   └── ...
├── models/                   # SQLAlchemy ORM models
├── scripts/                  # Utility scripts
│   └── reset_db.py           # Wipe and reinitialize the database
└── utils/                    # DB connection, logging, validators
```

---

## API Rate Limits

| Source | Limit | Handling |
|---|---|---|
| arXiv | 3 req/sec | 0.34s delay between requests |
| GitHub | 5,000 req/hour (authenticated) | Requires `GITHUB_TOKEN` |
| Hugging Face | Higher with token | `HF_API_TOKEN` recommended |

---

## Roadmap

### v0.4.0 (current)
- [x] Learning Path: era-based historical view of any research topic — BookOpen icon in feed header opens topic input
- [x] Era bucketing: Before 2018 / 2018–2020 / 2021–2022 then 2-year pairs (2023–2024, 2025–2026, …); odd current year gets a single-year final bucket
- [x] arXiv: Relevance sort for Learning Path to span multiple eras (vs SubmittedDate for Quick Search)
- [x] Claude-generated per-era summaries + topic overview; graceful fallback without API key
- [x] Learning Path results cached in SQLite for 7 days — instant on repeat lookups
- [x] HF models + GitHub repos fetched once at topic level and shown in each era tab

### v0.3.4
- [x] Quick Search: result limits raised — fetch 20 per source, keep top 15 after Claude scoring (max 45 results total, up from 20)
- [x] Fix overview showing static text when arXiv fails: always attempts Claude call so invalid key falls through to the API key registration prompt
- [x] arXiv: 2 s pre-request sleep + longer retry delay (5 s) + 2 retries to reduce consecutive-search 429s
- [x] Search timeout raised from 45 s to 60 s to accommodate larger result sets

### v0.3.3
- [x] Browser tab favicon: `frontend/app/favicon.ico`
- [x] Quick Search: loading progress now driven by real SSE events from the backend (fetching → scoring → overview), replacing the time-estimate approximation
- [x] Quick Search: per-source completion badges shown in real time (arXiv ✓, Hugging Face ✓, GitHub ✓) as each source finishes
- [x] Quick Search: source error banners — shows reason (rate limit with minutes-remaining countdown, auth error, timeout) per source after search completes
- [x] Quick Search: content-type filter buttons (Papers / Models / Repos) now filter results instantly client-side — no re-search required
- [x] Quick Search: suggested keywords updated to 2025 AI trends — reasoning, multimodal agent, LoRA, RAG, MoE, RLHF
- [x] Fix GitHub search returning zero results for date-filtered queries: changed `created:` qualifier to `pushed:` so repos with recent commits appear, not just newly created repos
- [x] Fix HuggingFace returning irrelevant models: pre-filter candidates where the keyword appears only in the username (e.g. `xxragxx/unrelated`); pass model tags to Claude for better relevance scoring
- [x] Fix AI key prompt not appearing when key exists but is invalid: prompt now triggers on missing summary, not just missing key

### v0.3.2
- [x] Language toggle now pinned to top-right on all screens (was Welcome-only)
- [x] Default feed: replaced mock papers with a search empty state + suggested keyword chips
- [x] Quick Search: multi-keyword support — add keywords as chips using comma or Enter; searched as OR query
- [x] Quick Search: 60 s timeout with AbortController; search error shows "Back to feed" button
- [x] Quick Search: step-by-step loading progress indicator with elapsed timer
- [x] Quick Search: when ANTHROPIC_API_KEY is missing, show registration prompts in overview and card summary slots
- [x] Fix HuggingFace `direction` parameter removed in newer huggingface_hub versions

### v0.3.1
- [x] Onboarding trimmed to 2 steps (categories → keywords); calibration step removed — it was showing fake papers with no actual effect
- [x] Keywords step is now optional — users can skip directly to the feed
- [x] Quick Search: custom date filters added — "Last N months" and "YYYY-MM to YYYY-MM" range picker
- [x] Suggested keywords updated for 2025 trends: reasoning, LoRA, VLM, fine-tuning

### v0.3.0
- [x] Quick Search: keyword search across arXiv, Hugging Face, GitHub simultaneously
- [x] Claude-powered relevance scoring and one-sentence summaries per result
- [x] Claude-generated topic overview for each search
- [x] Period filter (past week / month / 3 months / all time) and content-type filter
- [x] Fix Settings → Reset Database (POST /api/admin/reset-db was 404)

### v0.2.1
- [x] English / Korean language toggle (Welcome screen + Settings)
- [x] Language preference persisted across sessions
- [x] Reorganized research categories: split RL/Agent → AI Agents + Reinforcement Learning, added Generative AI (10 categories total)

### v0.2.0
- [x] FastAPI backend scaffold with full route structure
- [x] Next.js 15 frontend — onboarding flow (categories → keywords → calibration → feed)
- [x] SQLite schema + SQLAlchemy ORM
- [x] Data collection services: arXiv, Hugging Face, GitHub
- [x] One-command setup and run scripts (Windows + Mac/Linux)

### Upcoming
- [x] Learning Path: Era-based historical topic exploration
- [ ] Notifications: Subscriptions, in-app alerts, email digest
- [ ] Electron desktop packaging (no terminal required)
- [ ] MCP server for Claude.ai chat integration

---

## License

MIT — see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

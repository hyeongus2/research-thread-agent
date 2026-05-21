# Research Thread Agent

A local-first, open-source research curation tool for AI/ML researchers and developers.

Automatically collects papers, models, and repositories from **arXiv**, **Hugging Face Hub**, and **GitHub**, then presents them in two modes:

- **Quick Search** — Latest content feed for a keyword and time period you specify
- **Learning Path** — Historical development of a topic, organized chronologically by era

All data is stored on your local machine (SQLite). No external server, no account required, no telemetry.

---

## Features

### Quick Search (In Development)
Search across three sources simultaneously with a single keyword:
- Filter by date range (preset periods or custom range)
- Filter by content type (papers / models / repos)
- Claude-powered relevance scoring and summarization
- Every result includes a clickable link to the original source

### Learning Path (In Development)
Enter any research topic (e.g., *Retrieval-Augmented Generation*) and get:
- Key papers from each era, ordered by historical development
- Hugging Face models and datasets relevant to that period
- GitHub implementations from the same time
- Claude-generated summary explaining what changed and why

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

### v0.2.0 (current)
- [x] FastAPI backend scaffold with full route structure
- [x] Next.js 15 frontend — onboarding flow (categories → keywords → calibration → feed)
- [x] SQLite schema + SQLAlchemy ORM
- [x] Data collection services: arXiv, Hugging Face, GitHub
- [x] One-command setup and run scripts (Windows + Mac/Linux)

### Upcoming
- [ ] Quick Search: Research Thread generation with Claude + RAG
- [ ] Learning Path: Era-based historical topic exploration
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

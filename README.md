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
| UI | Streamlit 1.28+ |
| AI | Claude API (`claude-sonnet-4-20250514`) |
| Vector search | ChromaDB + LangChain |
| Data sources | arXiv API, Hugging Face Hub API, GitHub REST API |
| Storage | SQLite via SQLAlchemy |
| Scheduler | APScheduler |

---

## Getting Started

### Prerequisites

- Python 3.9+
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

`setup` automatically creates a `.venv` virtual environment, installs all dependencies, and copies `.env.example` → `.env` on first run.

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

The app opens at [http://localhost:8501](http://localhost:8501).

| Page | URL |
|---|---|
| Home | [http://localhost:8501](http://localhost:8501) |
| Quick Search | [http://localhost:8501/Quick_Search](http://localhost:8501/Quick_Search) |
| Learning Path | [http://localhost:8501/Learning_Path](http://localhost:8501/Learning_Path) |
| Settings | [http://localhost:8501/Settings](http://localhost:8501/Settings) |

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
├── setup.bat / setup.sh      # One-command setup (venv + install)
├── run.bat / run.sh          # Start the app
├── streamlit_app.py          # App entry point
├── pages/                    # Streamlit multi-page views
├── services/                 # Data collection and business logic
│   ├── arxiv_service.py
│   ├── hf_service.py
│   ├── github_service.py
│   ├── claude_service.py
│   ├── thread_service.py
│   └── ...
├── models/                   # SQLAlchemy ORM models
├── scripts/                  # Utility scripts
│   └── reset_db.py           # Wipe and reinitialize the database
├── utils/                    # DB connection, logging, validators
└── config/                   # App settings
```

---

## API Rate Limits

| Source | Limit | Handling |
|---|---|---|
| arXiv | 3 req/sec | 0.34s delay between requests |
| GitHub | 5,000 req/hour (authenticated) | Requires `GITHUB_TOKEN` |
| Hugging Face | Higher with token | `HF_API_TOKEN` recommended |

---

## Roadmap (v0.1.2)

- [x] Foundation: DB schema, data collection services, app scaffold
- [x] One-command setup script, DB reset utility
- [x] Cross-platform setup (Windows .bat, Mac/Linux .sh with venv fixes)
- [ ] Quick Search: Research Thread generation with Claude + RAG
- [ ] Learning Path: Era-based historical topic exploration
- [ ] Notifications: Subscriptions, in-app alerts, email digest

---

## License

MIT — see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

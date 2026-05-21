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
- An [Anthropic API key](https://console.anthropic.com)
- A [GitHub personal access token](https://github.com/settings/tokens)

### Installation

```bash
git clone https://github.com/hyeongus2/research-thread-agent.git
cd research-thread-agent
pip install -r requirements.txt
```

### Configuration

```bash
cp .env.example .env
```

Open `.env` and fill in your API keys:

```
ANTHROPIC_API_KEY=sk-ant-...   # required
GITHUB_TOKEN=ghp_...           # required
HF_API_TOKEN=hf_...            # optional
RESEND_API_KEY=re_...          # optional, for email notifications
USER_EMAIL=you@example.com     # optional, for email notifications
```

### Run

```bash
streamlit run streamlit_app.py
```

Open [http://localhost:8501](http://localhost:8501) in your browser.

---

## Project Structure

```
research-thread-agent/
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

## Roadmap (v0.1.0 — In Development)

- [x] Foundation: DB schema, data collection services, app scaffold
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

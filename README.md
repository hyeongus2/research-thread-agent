# Research Thread Agent

A local-first, open-source research curation tool for AI/ML researchers and developers.

Automatically collects papers, models, and repositories from **Semantic Scholar**, **Hugging Face Hub**, and **GitHub**, then presents them in two modes:

- **Quick Search** — Papers, models, and repos for a keyword, sorted by quality signal (citations / downloads / stars)
- **Learning Path** — Historical development of a topic, organized chronologically by era
- **Trending Feed** — Community-upvoted papers from Hugging Face (daily / weekly / monthly)
- **My Feed** — Personalized paper alerts based on your subscribed categories and keywords

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
- **Papers** tab — Semantic Scholar: up to 1,000 papers sorted by citation count
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

### Research Lineage
Enter a research topic and explore citation-based connections between papers:
- Seed papers are fetched from Semantic Scholar by keyword
- Each seed paper's reference list is expanded one level (depth = 1)
- Connections displayed as **Foundational Paper → Citing Paper**
- Papers ranked by an importance score (citation count, recency, seed status)
- Influential citation edges marked with ★

**Differs from Learning Path**: Learning Path groups papers into chronological eras with AI-generated summaries. Research Lineage shows citation-based relationships between individual papers based on metadata.

> **Limitation**: Citation relationships are metadata-based approximations. A paper citing another may use it as background, comparison, method, dataset, or critique. Citation edges do not guarantee direct intellectual inheritance.

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
│   └── routes/                        # auth, search, learning, subscriptions, notifications, venues
├── services/                          # Pure Python business logic
│   ├── semantic_scholar_service.py    # Semantic Scholar paper search (citation-sorted); OpenAlex fallback
│   ├── hf_service.py                  # HF Hub model search (download-sorted)
│   ├── github_service.py              # GitHub repo search (star-sorted)
│   ├── claude_service.py              # On-demand AI summaries (overview + per-paper)
│   ├── thread_service.py              # Quick Search orchestration
│   ├── historical_thread_service.py   # Learning Path orchestration
│   ├── notification_service.py        # My Feed: check subscriptions, create notification records
│   └── scheduler_service.py           # APScheduler daily background check
├── models/                            # SQLAlchemy ORM models
│   └── paper_code.py                  # PaperCodeLink — PWC archive code links (arxiv_id → repo_url)
├── scripts/                           # Utility scripts
│   ├── reset_db.py                    # Wipe and reinitialize the database
│   └── import_pwc_links.py            # One-time import of Papers with Code archive into SQLite
└── utils/                             # DB connection, logging, validators
```

---

## API Rate Limits

| Source | Limit | Handling |
|---|---|---|
| Semantic Scholar | 100 req/5 min (no key) · 1 req/sec (with key) | Bulk endpoint returns up to 1,000 papers per request |
| GitHub | 5,000 req/hour (authenticated) | Requires `GITHUB_TOKEN` |
| Hugging Face | Higher with token | `HF_API_TOKEN` recommended |
| OpenAlex | 10 req/sec | Automatic fallback when Semantic Scholar is rate-limited |
| Claude API | Per-token billing | On-demand only — never called automatically |

---

## Roadmap

### v0.10.5 (current)
- [x] **Search result limit now user-controlled up to 1,000** — Settings paper limit cap raised from 100 to 1,000 (models/repos: 0–200); bulk endpoint `limit` parameter was being ignored server-side and now correctly slices results after fetch; default raised from 50 → 100 papers
- [x] **My Feed field coverage** — `fieldsOfStudy=CS,Mathematics,Statistics,Engineering` filter applied to My Feed paper fetches (was missing; Quick Search, Learning Path, Research Lineage already had it); papers per topic raised from 10 → 50
- [x] **AI input capped** — Quick Search AI Overview sends top 30 papers (citation-sorted) instead of the full result set, preventing excessive token usage on large fetches
- [x] **Learning Path overview no longer truncated** — `max_tokens` raised from 2,000 → 4,000; prompt reduced from 4–5 paragraphs to 3 focused paragraphs with explicit instruction to finish the final sentence completely
- [x] **Learning Path build progress text** — era rows now show descriptive status text on the left (`"Before 2018 · fetching papers…"` / `"Before 2018 · AI analyzing…"` / `"Analysis written ✓"`) instead of a bare circle or checkmark symbol
- [x] **Learning Path settings range labels** — limit input descriptions now show allowed ranges (papers per era: 3–20 · models/repos: 0–20)

### v0.10.4
- [x] **Semantic Scholar bulk endpoint** — switched from standard search (max 100) to bulk search endpoint (max 1,000) across Quick Search, Learning Path, and Research Lineage; citation-count sort applied server-side
- [x] **ML acronym query expansion** — single-token queries matching a known AI/ML acronym are automatically expanded before sending to Semantic Scholar (e.g. `RAG` → `RAG retrieval augmented generation`), so papers using the full phrase are also retrieved; 100 terms covering foundational architectures, transformers, LLMs, fine-tuning/alignment (GRPO, KTO, ORPO, …), diffusion, vision, NLP tasks, RL, and graph learning; multi-token queries are sent as-is to avoid distorting relevance ranking
- [x] **Research Lineage quality improvements** — SVG edges redrawn as bezier curves; isolated nodes (no edges) hidden from graph view and counted in the subset note; reference edges that point to papers *newer* than the seed are filtered out as metadata anomalies; top-seed cap reduced from 5→3 API calls

### v0.10.3
- [x] **Learning Path field coverage expanded** — Semantic Scholar `fieldsOfStudy` filter now includes Mathematics, Statistics, and Engineering in addition to Computer Science; captures optimization theory (Adam/SGD convergence proofs, LoRA geometry), audio/multimodal signal processing (EESS), and edge-efficiency papers that would otherwise be missing from era results

### v0.10.2
- [x] **Unified paper card component** — single `PaperCard` component replaces four separate card implementations across Quick Search, My Feed, Learning Path, and Citation Graph; all cards now share identical layout, abstract toggle, and action buttons
- [x] **Weekend / holiday fallback for Trending** — when HF Daily Papers has no papers for today (weekends, holidays), automatically scans back up to 7 days and shows the most recent available batch with an explanatory note below the period selector
- [x] **My Feed auto-mark-as-read** — red dots on My Feed cards clear automatically as soon as the tab loads, without requiring a manual click
- [x] **AI output plain prose** — fixed raw markdown symbols (`##`, `**`, bullet points) appearing verbatim in AI Overview, per-paper summaries, and Learning Path era summaries; all three AI functions now instruct Claude to write plain prose
- [x] **Deeper Learning Path era analysis** — per-paper analysis now requests 2–4 substantive sentences per field (Problem / Solution / Significance / Limitations) with explicit guidance on what each field should cover; `max_tokens` raised from 4,000 to 8,000 to accommodate longer output; era summary raised to 3–4 sentences
- [x] **BibTeX on all paper cards** — "Cite" copy button now available in My Feed, Learning Path, and Citation Graph cards (was Quick Search and Venues only)

### v0.10.1
- [x] **Venues tab: accurate venue filtering** — switched from keyword search + post-filter to Semantic Scholar bulk search `venue` parameter, which filters by actual publication venue; NeurIPS 2024 results went from ~360 to 4,257 papers with correct top-cited papers (YOLOv10, VMamba, Depth Anything V2, etc.)
- [x] **Venues tab: no search query bias** — `query` parameter removed entirely; `venue` + `year` filter alone is sufficient and avoids dropping papers that don't match a topic keyword
- [x] **Venues tab: dynamic years** — year list generated from current year back to 2010; selecting the current year shows a note that SS may tag papers by arXiv update date rather than the actual conference year
- [x] **Venues tab: Settings integration** — paper limit for Venues tab now configurable in Settings (same as Quick Search limits)
- [x] **Research Lineage + Learning Path: i18n** — "Graph", "All Results", subset note, and "View on Semantic Scholar" strings now use i18n keys; fully translated in EN and KO
- [x] **Search placeholders** — Learning Path and Research Lineage input placeholders simplified to "e.g. RAG" / "예: RAG"

### v0.10.0
- [x] **Research Lineage** — new Search mode: citation-based graph (SVG, year-based left→right layout) showing how seed papers connect to the foundational works they cite; depth-1 reference expansion via Semantic Scholar; importance score per paper; influential edges highlighted; side panel on node click; "All Results" fallback tab
- [x] **Venues tab** — 4th navigation tab for browsing papers by conference and year (NeurIPS, ICML, ICLR, CVPR, AAAI, ECCV, ACL, EMNLP · 2020–2025)
- [x] **BibTeX copy button** — "Cite" button on Quick Search and Venues paper cards; generates and copies a formatted BibTeX entry to the clipboard (`@inproceedings` for conference papers, `@article` for arXiv preprints)
- [x] **Code link button** — "Code" button on paper cards when a GitHub implementation is available; powered by the Papers with Code archive (run `python scripts/import_pwc_links.py` once to populate)
- [x] **arXiv ID extraction** — Semantic Scholar responses now include `arxiv_id` from `externalIds`, enabling PWC code-link matching and future integrations
- [x] **Search speed fix** — global `threading.Semaphore(1)` + 1 s inter-request gap prevents concurrent Semantic Scholar calls from cascading 429s; minimises OpenAlex fallback (worst-case latency: ~40 s → ~2 s per query)
- [x] **LAN support** — uvicorn binds to `0.0.0.0`; frontend API URL is hostname-dynamic; sensitive endpoints (API key save, DB reset) remain localhost-only

### v0.9.x
- [x] Fix: Trending "Today" tab uses UTC date — avoids empty results for UTC+9 (KST) users before HF's daily update window
- [x] Fix: Bell badge updates immediately after My Feed SSE check completes; bell unread count decrements immediately on individual notification read
- [x] Fix: My Feed SSE check no longer re-runs on every tab visit — only when papers are absent or interests were explicitly saved; auto-refreshes when background scheduler adds new papers
- [x] Fix: saving interests in Settings always triggers a My Feed re-check; email digest sends correctly for users without an explicit `notification_settings` row
- [x] Fix: notification settings PATCH accepts fields independently; Breakthrough Alerts toggle persists across Settings reopens
- [x] Settings: API key and Claude model selectable in-app (saved to `.env`); Daily Digest toggle defaults on for new users

### v0.8.0
- [x] My Feed: personalized paper alerts from subscribed categories and keywords
  - Background scheduler (daily) checks each user's preferences against Semantic Scholar
  - Real-time SSE generation progress per topic (same pattern as Learning Path)
  - Papers sorted globally by citation count; inline abstract expand/collapse; citation count badge per card
  - Bell icon in header shows unread count badge; click opens notification dropdown
  - Notification dropdown: mark single or all as read, source link opens in new tab
  - Auto-generates feed after onboarding completes; re-generates when Settings interests are saved
- [x] Semantic Scholar 429 handling: triple-retry (immediate → 10 s → 30 s) before OpenAlex fallback
- [x] Trending and My Feed results cached for 24 h (no redundant fetches within the same day)
- [x] Category key unification — onboarding, Settings, and notification service now use identical keys

### v0.7.x
- [x] Trending Feed: daily / weekly / monthly period filter (fetches multiple days in parallel, deduplicated by arXiv ID)
- [x] Trending Feed: each card has inline expand/collapse for the summary text
- [x] Learning Path: Papers / Models / Repos tabs per era — no more scrolling to the bottom to see repos
- [x] Learning Path: era tab strip scrollable with mouse wheel; horizontal scroll no longer leaks to page scroll at edges
- [x] Learning Path: paper card abstract toggle unified to Quick Search style
- [x] Quick Search: AI Summary no-key hint fix — retries work correctly; hint text fills available space

### v0.6.0
- [x] 3-tab navigation: Trending | My Feed | Search
- [x] Learning Path integrated into Search tab as a Quick Search ↔ Learning Path toggle
- [x] Quick Search: history dropdown on search bar focus, per-item delete
- [x] Learning Path: history list in idle state, click to reload from cache, per-item delete
- [x] HF Daily Papers trending feed on the Trending tab
- [x] Learning Path cache TTL raised from 7 days → 90 days

### v0.5.x
- [x] Quick Search: Semantic Scholar replaces arXiv (citation-count sorting); OpenAlex automatic fallback
- [x] Papers / Models / Repos separated into tabs; pagination (10 / 25 / 50 per page); result limits raised to 100 / 50 / 50
- [x] Paper cards: inline abstract expand/collapse, citation count + venue badge; scroll-to-top / bottom buttons
- [x] AI Overview and AI Summary on-demand buttons (no automatic LLM calls); language-aware responses (EN / KO)
- [x] Multi-keyword AND semantics across all three sources
- [x] Learning Path: Semantic Scholar replaces arXiv; per-era date-filtered queries; configurable limits in Settings
- [x] Learning Path: per-paper AI analysis (Problem / Solution / Significance / Limitations); real-time SSE progress
- [x] Learning Path: sequential era fetching with delay; abstract expand/collapse; topic title in results
- [x] Quick Search: search history auto-expires after 30 days; Settings "Clear search history" button

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

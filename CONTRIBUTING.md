# Contributing to Research Thread Agent

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository
2. Run `setup.bat` (Windows) or `./setup.sh` (Mac/Linux) to install dependencies
3. Copy `.env.example` to `.env` and fill in your API keys
4. Start the dev servers with `run.bat` / `./run.sh`

## How to Contribute

### Reporting Bugs

Open a GitHub issue using the **Bug Report** template. Include:
- Steps to reproduce
- Expected vs. actual behavior
- Your OS and Python/Node versions

### Suggesting Features

Open a GitHub issue using the **Feature Request** template. Describe the use case and why it would be useful.

### Submitting Code

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes following the code standards below
3. Test that the app runs end-to-end (`run.bat` / `./run.sh`)
4. Commit with a descriptive message following the convention below
5. Open a Pull Request against `main`

## Code Standards

- **Python**: 3.9+, PEP 8, type hints on all function signatures
- **JavaScript**: camelCase variables, PascalCase component files
- **No comments** that restate what the code does — only add comments for non-obvious logic
- **No Korean or emoji** inside `.py` files
- All UI strings go through `frontend/app/i18n/` — never hardcode text in components

## Commit Convention

```
feat:     new feature
fix:      bug fix
refactor: no behavior change
docs:     documentation only
test:     tests only
chore:    dependencies, tooling
```

Example: `feat: add citation count filter to quick search`

## Project Structure

See [CLAUDE.md](CLAUDE.md) for a full architecture overview and implementation notes.

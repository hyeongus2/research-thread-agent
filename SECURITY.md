# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 1.0.x | Yes |
| < 1.0 | No |

## Reporting a Vulnerability

If you discover a security vulnerability, please do **not** open a public GitHub issue.

Instead, report it by emailing the maintainer directly (see the GitHub profile for contact info), or open a [GitHub Security Advisory](https://github.com/hyeongus2/research-thread-agent/security/advisories/new) (private disclosure).

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact

You can expect an acknowledgment within 72 hours and a resolution timeline within 7 days for critical issues.

## Notes

- This app runs entirely on your local machine. No data is sent to any external server except the APIs listed in the README (Semantic Scholar, HuggingFace, GitHub, Anthropic).
- API keys are stored in a local `.env` file, which is excluded from git via `.gitignore`.

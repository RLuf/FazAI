# Repository Guidelines

This document helps contributors work effectively in this repository and keep changes consistent and testable.

## Project Structure & Module Organization
- `opt/fazai/tools/`: Node.js tools and integrations (e.g., `agent_supervisor.js`, `rag_ingest.js`).
- `worker/`: C/C++ Gemma worker and IPC server; builds a local ND‑JSON provider on `unix:/run/fazai/gemma.sock`.
- `bin/`: CLI binary (`fazai`) and build helpers; `tui/` contains TUI bits if enabled.
- `gemma.cpp/`: Upstream Gemma engine sources and tests.
- `etc/`, `var/`: Config and logs at runtime; mounted in Docker.
- `tests/`: Shell/PowerShell tests (`*.test.sh`, `*.tests.ps1`).
- Specs: see `SPEC.md` for protocol schemas; top‑level docs in `README.md`.

## Build, Test, and Development Commands
- Install: `sudo ./install.sh` (provisions deps, CLI, services). Uninstall: `sudo ./uninstall.sh`.
- Tests: `npm test` (runs `tests/*.test.sh` and WSL PowerShell where available).
- TUI/Config/Web helpers: `npm run tui`, `npm run config-tui`, `npm run web`.
- Docker: `docker compose up -d --build` (binds `3120`; optional Qdrant at `6333`).

## Coding Style & Naming Conventions
- JavaScript: 2‑space indent, semicolons, `camelCase` functions/vars, `PascalCase` classes, `UPPER_SNAKE_CASE` constants. Tool filenames prefer `lower_snake_case.js`.
- C/C++: follow existing style in `worker/` (4‑space indent, include guards, minimal iostreams in headers).
- Keep functions small, pure where possible, and log with `winston` in JSON.

## Testing Guidelines
- Add tests alongside existing scripts in `tests/` using the `*.test.sh` pattern; keep them idempotent.
- CI entry is `npm test`; ensure local tests pass and avoid external network reliance.
- For protocol changes, add/adjust contract checks per `SPEC.md` and include fixtures.

## Commit & Pull Request Guidelines
- Commits: short imperative summary, scoped body, reference issues (e.g., `Fix: opnsense list health (#123)`).
- Update docs: `CHANGELOG.md`, `SPEC.md` (when schemas change), and relevant README sections.
- PRs: clear description, reproduction steps, test evidence, and screenshots/logs when UI/metrics change.

## Security & Agent Tips
- Secrets live under `/etc/fazai/secrets/`; never commit them. Enforce mTLS for remote agents.
- Respect idempotency (`action_id`) and timeouts for southbound calls. Local provider uses ND‑JSON over Unix socket at `/run/fazai/gemma.sock`.
- OPNsense integration is native (no agent): see daemon endpoints `/opn/*` and keep operations read‑only by default.

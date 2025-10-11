# Repository Guidelines

## Project Structure & Module Organization
- `bin/`: CLI entrypoints (e.g., `bin/fazai`, `fazai_cli_natural.py`).
- `opt/`: Runtime app code deployed under `/opt/fazai` (Node services, tools).
- `worker/`: Gemma worker sources and build artifacts (`worker/bin/fazai_gemma_worker.py`, bindings, C++ build).
- `etc/`: Config templates and shell completion (installed to `/etc/fazai`).
- `tests/`: Shell, Python, and JS integration tests.
- `install.sh` / `uninstall.sh`: System install/uninstall scripts.

## Build, Test, and Development Commands
- Install locally: `bash install.sh` (deploys to `/opt/fazai`, does not overwrite existing configs).
- Run tests (aggregate): `npm test`.
- End‑to‑end worker test: `bash tests/test_cli_worker_integration.sh`.
- Worker quick checks:
  - Python compile: `python3 -m py_compile worker/bin/fazai_gemma_worker.py`.
  - Run worker locally: `python3 worker/bin/fazai_gemma_worker.py`.

## Coding Style & Naming Conventions
- Python: 4‑space indent, PEP8‑oriented; snake_case for files and symbols; prefer type hints where practical.
- Node/JS: Node 22+, prefer async/await; camelCase for symbols; kebab/snake for CLI names.
- Logs: structured, actionable messages; include component prefixes (e.g., `worker:`, `cli:`).
- Config access: read from `/etc/fazai/fazai.conf` only; never hardcode secrets or model paths.

## Testing Guidelines
- Primary tests live in `tests/` with patterns `test_*.py`, `*.test.sh`, and specific JS probes.
- CI‑equivalent locally: `npm test` plus targeted scripts (e.g., `tests/test_gemma_native.py`).
- Ensure E2E path works: CLI → Worker → libgemma → Qdrant; avoid mocks/stubs.

## Commit & Pull Request Guidelines
- Commits: imperative, scoped prefix when useful (e.g., `worker:`, `cli:`, `installer:`), concise body with rationale.
- PRs: include problem statement, summary of changes, test evidence (commands/output), and any config or install notes.
- Avoid drive‑by refactors; keep changes focused and reversible.

## Security & Configuration Tips
- Never overwrite existing configs; create defaults only if missing.
- Model path and Gemma settings must come from `/etc/fazai/fazai.conf`.
- Qdrant: configure host/port; collections `fazai_memory` and `fazai_kb`; typical `vector_dim=1024`.
- Sockets/IPC: Unix socket at `/run/fazai/gemma.sock`; follow ND‑JSON protocol.
- Native bindings: load `gemma_native*.so` from approved locations (e.g., `/opt/fazai/lib`); handle import errors gracefully.


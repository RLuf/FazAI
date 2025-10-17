# Repository Guidelines

## Project Structure & Module Organization
FazAI is a TypeScript CLI that translates natural-language requests into guarded Linux commands. Core sources live in `src/` (`app.ts` orchestrates the CLI, `linux-admin.ts` wraps model calls, `linux-executor.ts` executes confirmed commands, `cli-mode.ts` implementa o modo chat/terminal com memória persistente, `memory.ts` gerencia armazenamento, `research.ts` coordena pesquisas MCP/web). MCP helpers live under `src/mcp/` (`client.ts`, `context7.ts`, `server.ts`). Bundled output lands in `dist/` via `tsup`, and the published binary loads from `dist/app.cjs`. Integration harnesses and fixtures stay in `tests/`; keep AI prompt samples beside their spec (e.g., `tests/call-ai.test.ts`). Configuration templates live in `fazai.conf.example`; store real keys in `fazai.conf` and keep it out of version control. Older experiments rest in `archive/`.

## Build, Test, and Development Commands
- `npm install` installs production and development dependencies for Node ≥18.17.
- `npm run dev` launches the CLI through `tsx`, ideal for iterative development with TypeScript source.
- `npm run build` invokes `tsup` to emit CommonJS bundles and type declarations into `dist/`.
- `npm start` executes the built binary (`node dist/app.cjs`) mirroring the global `fazai` entrypoint.
- `npx tsx tests/call-ai.test.ts` runs the current streaming integration check; add any required sample prompt files under `tests/` before executing.

## Coding Style & Naming Conventions
The project targets strict TypeScript with CommonJS output; keep new code compatible with the ESM-style imports used across `src/`. Prefer two-space indentation, stick to `const` unless mutation is required, and reserve template literals for interpolated strings. File names follow kebab-case (`linux-prompt.ts`) while classes and types use PascalCase (`LinuxCommandExecutor`). Export named helpers so bundling stays tree-shakable.

## Testing Guidelines
Tests currently rely on lightweight streaming checks; treat them as integration smoke tests until broader coverage exists. Place new specs under `tests/` with the `.test.ts` suffix, and import from `src/` rather than `dist/` to exercise TypeScript source. Provide deterministic fixtures alongside each test and run `npx tsx tests/<name>.test.ts` before submitting.

## Commit & Pull Request Guidelines
Git history favours short, imperative subjects (`Add safety prompt parser`, `verbump`); follow that format and add concise body notes for rationale and tests. Pull requests should summarise behaviour changes, list manual verification (`fazai --dry-run`, `npm run build`), and flag configuration updates. Include CLI transcripts or screenshots when prompts or output change, and state whether `dist/` artifacts need regeneration.

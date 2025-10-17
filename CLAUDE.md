# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FazAI is a lightweight (~80kb) AI-powered Linux system administrator tool forked from Mandark. It supports multiple AI models (Claude, GPT, Llama) and can:
- Edit multiple files based on natural language instructions
- Answer questions about code (local or from GitHub repos)
- Execute Linux system administration tasks with safety checks
- Process GitHub repositories directly
- Verify edits before applying them

The project is written in TypeScript and designed to be run via npx without installation.

## Build and Development

### Build the project
```bash
npm run package
# Uses tsup to bundle src/app.ts into dist/app.cjs
```

### Run locally during development
```bash
# Direct execution (requires tsx or ts-node)
node --loader ts-node/esm src/app.ts [args]

# Or after building
node dist/app.cjs [args]
```

### Test the built package
```bash
npm link
fazai --help
```

### Research Layer
- `src/research.ts`: orchestration layer for MCP Context7 queries with web-search fallback
- `src/mcp/context7.ts`: adapter that talks to MCP servers or local commands
- `src/mcp/client.ts`: lightweight client used by the CLI
- `src/mcp/server.ts`: optional HTTP bridge exposing FazAI research as an MCP-compatible endpoint
- Configure via `fazai.conf` keys (`MCP_CONTEXT7_URL`, `MCP_CONTEXT7_COMMAND`, `WEB_SEARCH_PROVIDER`, `FAZAI_DISABLE_RESEARCH`)

### CLI Mode
- `src/cli-mode.ts`: interactive chat shell (`fazai --cli`) com memória persistente, auto-complete e suporte a `/exec`
- `src/memory.ts`: utilitários para armazenar histórico e contexto em `~/.fazai`

## Core Architecture

### Entry Point and Modes

The main entry point is [src/app.ts](src/app.ts). The application operates in four distinct modes:

1. **Code Editing Mode** (default): Process local files/folders or GitHub repos and make AI-guided edits
2. **Ask Mode**: Query code or ask general questions (`fazai ask <urls> "question"`)
3. **Copy/Pipe Modes**: Extract and output code (`fazai copy/pipe <urls>`)
4. **Linux Admin Mode**: Convert natural language to safe Linux commands (`fazai --admin`)

### Key Components

#### AI Providers ([src/call-ai-*.ts](src/))
- [call-ai-claude.ts](src/call-ai-claude.ts): Anthropic Claude integration with streaming
- [call-ai-gpt.ts](src/call-ai-gpt.ts): OpenAI GPT integration
- [call-fireworks.ts](src/call-fireworks.ts): Fireworks AI (Llama) integration
- All providers implement streaming and return `AsyncGenerator<EditPackets>`

#### Edit Processing ([src/edit-processor.ts](src/edit-processor.ts))
The `EditProcessor` class:
- Manages file loading and modification
- Presents colored diffs for user confirmation
- Applies edits in order (top to bottom)
- Handles package installation (via bun)
- Maintains edit history for rollback

#### File Processing ([src/process-files.ts](src/process-files.ts))
- Handles local files, directories, and GitHub repositories
- Adds line numbers to code (format: `L1: code`, `L2: code`)
- Filters imports unless `--include-imports` is set
- Uses fast-glob with configurable patterns
- Supports source directory detection for GitHub repos

#### Linux Admin Mode ([src/linux-admin.ts](src/linux-admin.ts), [src/linux-executor.ts](src/linux-executor.ts))
- Converts natural language to Linux commands
- Risk assessment (low/medium/high/critical)
- Requires confirmation for critical operations
- Supports dry-run mode for testing
- Provides rollback commands where possible
- Collects system info for context-aware suggestions

#### Edit Verification ([src/verify-edits.ts](src/verify-edits.ts))
- Uses a cheaper model (GPT-4o-mini by default) to verify edits
- Can skip invalid edits automatically
- Adds a safety layer before applying changes

### Type System ([src/types.ts](src/types.ts))

Core type definitions using Zod schemas:

```typescript
type Edits = {
  explain: string;           // Why this change is needed
  filename: string;          // Relative path to file
  change: {
    type: "addition";
    atLine: number;
  } | {
    type: "replacement";
    fromLineNumber: number;
    toLineNumber: number;
  };
  code: string;             // Code to insert/replace
  newPackages?: string[];   // Dependencies to install
}[];
```

Edit streams use `EditPackets`:
- `{ type: "edit", edit: Edit }`: Single edit
- `{ type: "alledits", edits: Edits }`: All edits complete
- `{ type: "error", error: string }`: Error occurred

### Model Configuration ([src/models.ts](src/models.ts))

Available models with cost estimates:
- `sonnet35`: Claude 3.5 Sonnet (default, 200K context)
- `haiku`: Claude 3 Haiku (cheaper, 200K context)
- `4omini`: GPT-4o-mini (verifier, 128K context)
- `4turbo`: GPT-4 Turbo (128K context)
- `llama405b`: Llama 3.1 405B via Fireworks (262K context)

Each model has `contextWindow`, `outputLength`, `inputCPM`, and `outputCPM` for token/cost estimation.

## Common Workflows

### Adding a New AI Provider

1. Create `src/call-ai-{provider}.ts` implementing the stream interface
2. Add model(s) to [src/models.ts](src/models.ts)
3. Update the provider switch in [src/app.ts](src/app.ts) (line ~458)
4. Implement streaming that yields `EditPackets`

### Modifying Edit Types

1. Update type definitions in [src/types.ts](src/types.ts)
2. Update Zod schemas for validation
3. Modify `EditProcessor.confirmEdit()` and `applyConfirmedEdits()` in [src/edit-processor.ts](src/edit-processor.ts)
4. Update prompts in [src/prompt.ts](src/prompt.ts)

### Adding New Commands/Modes

1. Parse new flags in [src/app.ts](src/app.ts) main function
2. Add mode-specific logic before the default code editing mode
3. Update `displayHelp()` function
4. Consider adding corresponding prompt files (see [src/askPrompt.ts](src/askPrompt.ts))

## Important Implementation Details

### Line Number Format
- Code is tagged as `L{number}: {code}` throughout the system
- Prompts instruct AI to reference line numbers in edits
- Line numbers are 1-indexed to match editor conventions
- Strip line numbers when showing diffs to users

### Edit Application Order
- Edits are sorted by line number (ascending) before application
- This prevents line number shifts from breaking subsequent edits
- See `EditProcessor.sortEdits()` in [src/edit-processor.ts](src/edit-processor.ts:208)

### GitHub Repository Processing
- Repos are cloned to `~/.mandark/repos/`
- Smart source directory detection (src/, lib/, packages/)
- Always includes README.md if present
- Supports direct GitHub URLs in all modes

### API Key Management
- API keys stored in `~/.mandark/config.json`
- Managed via [src/apiKeyUtils-fazai.ts](src/apiKeyUtils-fazai.ts)
- Prompted on first use per provider
- View configured keys with `fazai config`

### Edit History and Rollback
- All applied edits saved to `~/.mandark/edit-history.json`
- Use `fazai revert` to undo last batch of changes
- See [src/edit-history.ts](src/edit-history.ts)

## Testing

Currently minimal test coverage. See [tests/call-ai.test.ts](tests/call-ai.test.ts) for the test structure.

## Build Configuration

- **tsup** ([tsup.config.js](tsup.config.js)): Bundles TypeScript to single CommonJS file
- **Target**: Node.js 18.17.0+
- **Output**: `dist/app.cjs` (minified)
- **Entry**: `src/app.ts`

## Code Style Notes

- Uses ES modules (`import`/`export`)
- Async generators for streaming responses
- Chalk for colored terminal output
- Inquirer for interactive prompts
- Zod for runtime type validation
- Line length kept reasonable (~80-100 chars where practical)

# Plan: Pi Plugin for Claude Code (Replacing Codex)

## Context

This project (`pi-plugin-cc`) is the **OpenAI Codex plugin for Claude Code**. It wraps the `codex` CLI and its app-server protocol to provide review, task delegation, and job management commands. This plan defines building a **parallel `pi` plugin** that replaces Codex with **pi** as the coding agent.

## Architecture Overview

The key insight: **pi and Codex have fundamentally different integration models.**

| | Codex Plugin | Pi Plugin (new) |
|---|---|---|
| Runtime | `codex app-server` (JSON-RPC over stdout) | `pi` CLI (interactive/RPC mode) |
| Integration | Direct app-server client | Spawn `pi` processes + extension hooks |
| Commands | `codex-companion.mjs` subcommands | Pi companion CLI + job tracking |
| Job tracking | File-based state | File-based state (same pattern) |

## Step 1: Create the Plugin Directory Structure

```
plugins/pi/
├── .claude-plugin/
│   └── plugin.json           # Plugin metadata (name: "pi", version)
├── scripts/
│   ├── pi-companion.mjs      # Main CLI entry (like codex-companion.mjs)
│   ├── pi-subagent.mjs       # Spawn pi as a background subagent
│   └── lib/
│       ├── args.mjs          # Argument parsing (reuse from codex)
│       ├── fs.mjs            # File helpers (reuse from codex)
│       ├── git.mjs           # Git helpers (reuse from codex)
│       ├── process.mjs       # Process helpers (reuse from codex)
│       ├── state.mjs         # Pi-specific job state management
│       ├── tracked-jobs.mjs  # Background job tracking
│       ├── render.mjs        # Output rendering
│       └── workspace.mjs     # Workspace resolution
├── commands/
│   ├── review.md             # /pi:review command docs
│   ├── rescue.md             # /pi:rescue command docs
│   ├── status.md
│   ├── result.md
│   ├── cancel.md
│   └── setup.md
├── agents/
│   └── pi-rescue.md          # Subagent definition (like codex-rescue.md)
├── skills/
│   └── pi-runtime/SKILL.md   # Skill for pi CLI usage
├── hooks/
│   └── hooks.json            # Session hooks (like codex)
├── schemas/
│   └── review-output.schema.json
├── prompts/
│   ├── adversarial-review.md
│   └── stop-review-gate.md
├── LICENSE
├── NOTICE
└── CHANGELOG.md
```

## Step 2: Reuse Shared Libraries (Copy from `plugins/codex/scripts/lib/`)

Copy these files as-is since they are infrastructure-agnostic:

- `args.mjs` — argument parsing
- `fs.mjs` — file utilities
- `git.mjs` — git operations for review context
- `process.mjs` — process spawning/termination
- `workspace.mjs` — workspace root resolution

## Step 3: Implement Pi-Specific Core (`pi-companion.mjs`)

This replaces `codex-companion.mjs`. Key differences:

| Codex approach | Pi approach |
|---|---|
| Connect to `codex app-server` via JSON-RPC | Spawn `pi` as a subprocess with `--mode rpc` or interactive mode |
| `thread/start`, `turn/start`, `review/start` | Send prompts to pi via stdin/RPC, capture output |
| `account/read`, `config/read` for auth | Check `pi --list-models` and environment for API keys |
| `turn/interrupt` | Send SIGINT to pi subprocess |

**Core functions to implement:**

- `spawnPiProcess(cwd, prompt, options)` — spawn pi as a subprocess
- `runPiReview(cwd, target, options)` — run pi in review mode
- `runPiTask(cwd, prompt, options)` — delegate a task to pi
- `checkPiAvailability(cwd)` — verify pi is installed and configured
- `interruptPiProcess(pid)` — cancel running pi task

## Step 4: Implement Job State Management (`state.mjs` + `tracked-jobs.mjs`)

Adapt the codex job tracking for pi:

- Store job records as JSON files in `<workspace>/.pi-jobs/`
- Track: `jobId`, `kind` ("review"/"task"), `pid`, `status`, `threadId` → `piSessionId`
- Support foreground/background execution
- Provide `status`, `result`, `cancel` commands

## Step 5: Create Subagent Definition (`agents/pi-rescue.md`)

Similar to `codex-rescue.md` but instructs the model to use `pi` commands instead of `codex-companion.mjs`:

- Forward rescue requests to `pi` via bash
- Support `--background`, `--write`, `--model` flags
- Default to write-capable runs

## Step 6: Create Hooks (`hooks.json`)

Mirror Codex's session lifecycle hooks:

- `SessionStart` — initialize pi session state
- `SessionEnd` — clean up
- `Stop` — optional stop-gate review gate

## Step 7: Update Marketplace & Metadata

- Create `plugins/pi/.claude-plugin/plugin.json` with name `"pi"`
- Update `.claude-plugin/marketplace.json` to include the pi plugin
- Update `package.json` version and description

## Step 8: Write Tests

Create `tests/pi-*.test.mjs` mirroring the codex test patterns:

- `process.test.mjs` — pi process spawning
- `state.test.mjs` — job state management
- `render.test.mjs` — output formatting
- `git.test.mjs` — review context collection

## Step 9: Update README

Add pi plugin documentation alongside the codex docs:

- `/pi:setup`, `/pi:review`, `/pi:rescue`, `/pi:status`, etc.
- Installation: `/plugin install pi@openai-pi`
- Requirements: `pi` installed, API key configured

## Step 10: Integration & Testing

- Test with `pi` installed locally
- Verify foreground and background task execution
- Verify review and adversarial-review flows
- Verify job status/result/cancel lifecycle

---

## Key Design Decisions

1. **Reuse 60-70% of codex plugin infrastructure** — git, args, process, workspace libs are identical
2. **Replace only the app-server communication layer** — pi uses CLI subprocesses, not a persistent JSON-RPC server
3. **Same command surface** — `/pi:review`, `/pi:rescue`, etc. mirror `/codex:review`, `/codex:rescue`
4. **Same job tracking model** — file-based state for background jobs

---

## Implementation Order

1. Directory structure + copy shared libs (Steps 1-2)
2. Core `pi-companion.mjs` with `setup` and `status` (Step 3-4)
3. `review` and `adversarial-review` commands (Step 3)
4. `task` / `rescue` with background execution (Step 3-4)
5. Subagent, hooks, skills (Steps 5-6)
6. Metadata, tests, docs (Steps 7-9)

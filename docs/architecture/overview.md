# Architecture Overview

## What Curato Does

Curato manages Claude Code developer environments. It solves three problems:

1. **MCP servers break** — wrong Node version, missing binaries, stale registrations, dual-registry mismatches between VS Code and CLI
2. **Team setups diverge** — every developer has different plugins, MCP servers, and CLAUDE.md content
3. **Setup is manual and fragile** — installing an MCP server means editing JSON, resolving paths, restarting Claude Code, and hoping it works

Curato scans, diagnoses, and standardizes all of this via a CLI tool and Claude Code plugin.

## Two Layers

```
┌─────────────────────────────────────────────────┐
│                    Plugin                        │
│  13 commands · 3 agents · 2 skills              │
│  Conversational UX — user talks to Claude Code  │
│  /doctor  /scan  /repair  /setup-team  ...      │
├─────────────────────────────────────────────────┤
│                CLI + Library                     │
│  curato <command>  ·  TypeScript  ·  Node ≥18   │
│  install, setup, scan, register-mcp, ...        │
│  scanner/ and patcher/ reusable modules         │
└─────────────────────────────────────────────────┘
```

### Plugin Layer (`plugin/`)

Markdown files that Claude Code interprets at runtime. No executable code — the plugin is pure prompt engineering. Each command calls `npx -y curato <subcommand>` via Bash.

- **Commands** (`plugin/commands/*.md`) — user-invokable via `/command-name`
- **Agents** (`plugin/agents/*.md`) — specialized subagents (scanner, repair, bootstrap) with model hints
- **Skills** (`plugin/skills/*/skill.md`) — reusable capabilities invoked by agents and commands

### CLI + Library Layer (`cli/`)

A TypeScript CLI published as `curato` on npm. No MCP server — all work is done by running `curato` as a subprocess from the plugin, or directly from the terminal.

```
cli/src/
├── cli/
│   ├── index.ts        Entry point — arg routing, help text
│   ├── print.ts        ANSI color helpers
│   └── commands/
│       ├── install.ts       install <plugin> [--exclude] [--include]
│       ├── uninstall.ts     uninstall <plugin>
│       ├── setup.ts         setup [--config] [--dry-run]
│       ├── register-mcp.ts  register-mcp <name> <cmd> [--args] [--env] [--scope]
│       ├── remove-mcp.ts    remove-mcp <name> [--dry-run]
│       ├── scan.ts          scan [--json]
│       └── clear-cache.ts   clear-cache [--plugin] [--dry-run]
│
├── scanner/            Read-only detection (never mutates files)
│   ├── node-runtime.ts     Node version, nvm, PATH
│   ├── claude-config.ts    ~/.claude/ state
│   ├── mcp-registry.ts     VS Code + CLI MCP registrations
│   ├── plugin-state.ts     Installed plugins
│   ├── project-layout.ts   .claude/, CLAUDE.md, .mcp.json
│   └── team-config.ts      curato-setup.json parsing + inheritance
│
├── patcher/            Mutating operations (all backed up before write)
│   ├── backup.ts           Timestamped backups (~/.curato-backups/)
│   ├── file-writer.ts      Create / append / overwrite with dry-run
│   ├── json-merger.ts      safeMerge (target wins, arrays unioned)
│   ├── mcp-registrar.ts    Register MCP server to settings.json
│   ├── mcp-remover.ts      Remove from all config files
│   └── skill-filter.ts     Enable/disable plugin skills
│
├── utils/
│   └── platform.ts     Cross-platform paths + claude binary name
│
└── types.ts            All shared interfaces
```

## Data Flow

### Scan → Diagnose → Repair

```
User runs /scan or /doctor
    │
    ▼
npx curato scan (via Bash)
    │  Reads: ~/.claude/, .claude/, .mcp.json,
    │         node version, plugins, MCP registries
    │
    ▼
CheckResult[] { id, label, status, detail }
    │  Statuses: ok | warn | error | missing
    │
    ▼
User reviews output (or /doctor offers to repair)
    │
    ▼
npx curato register-mcp / install / etc.
    │  1. backupFile() → ~/.curato-backups/<timestamp>/
    │  2. Apply mutations (create, merge, append, register)
    │  3. Report what changed
```

### Team Setup

```
User runs /setup-team (or: curato setup)
    │
    ▼
readTeamConfig()
    │  Reads: ./curato-setup.json
    │  If "extends": fetches remote config from GitHub
    │  Merges: safeMerge(local, remote) — local wins
    │
    ▼
For each mcpServer → registerMcpServer() (both registries)
For each plugin   → claude plugin install + applySkillFilter()
For claudeMd      → create-if-missing or append-if-missing-section
    │
    ▼
Report: what was registered, installed, written
```

## Design Decisions

### Why CLI instead of MCP server?

Plugin commands call `npx -y curato` via Bash. This runs from the user's real shell environment, where environment variables (like `ADO_MCP_AUTH_TOKEN`) are actually set. An MCP server process is spawned by VS Code with only an explicit `env` block — it can't see `.zshrc` exports without extra configuration.

The CLI also works cross-platform, installs with a single `npm install -g curato`, and runs independently of Claude Code being open.

### Why Two Registries?

Claude Code has two separate MCP configuration paths:
- **VS Code extension**: `~/.claude/settings.json`
- **CLI**: `~/.claude.json`

They don't share state. `curato register-mcp` with `--scope user` writes to both simultaneously.

### Why safeMerge?

Configuration files accumulate state from multiple sources (user, team, Curato, other tools). Deleting keys is dangerous — you might remove something another tool depends on. `safeMerge` is additive-only:

- Target (existing config) keys always win
- Source (new config) keys are added if missing
- Arrays are unioned with deduplication
- Neither input is mutated

This means Curato can only add to your config, never break it.

### Why Backup Before Every Write?

Every mutation creates a timestamped snapshot in `~/.curato-backups/`. If something goes wrong, you can restore any file to its exact state before Curato touched it. There is no code path that writes a config file without backing it up first.

### Why Dry-Run Is Explicit?

Every function that mutates state takes `dryRun: boolean` as a required parameter. There is no default. When `dryRun: true`, the function returns what it would do without touching the filesystem.

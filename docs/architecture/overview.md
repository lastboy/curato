# Architecture Overview

## What Curato Does

Curato manages Claude Code developer environments. It solves three problems:

1. **MCP servers break** — wrong Node version, missing binaries, stale registrations, dual-registry mismatches between VS Code and CLI
2. **Team setups diverge** — every developer has different plugins, MCP servers, and CLAUDE.md content
3. **Setup is manual and fragile** — installing an MCP server means editing JSON, resolving paths, restarting Claude Code, and hoping it works

Curato scans, diagnoses, repairs, and standardizes all of this.

## Three Layers

```
┌─────────────────────────────────────────────────┐
│                    Plugin                        │
│  13 commands · 3 agents · 3 skills              │
│  Conversational UX — user talks to Claude Code  │
│  /doctor  /scan  /repair  /setup-team  ...      │
├─────────────────────────────────────────────────┤
│                  MCP Server                      │
│  21 tools · TypeScript · stdio transport         │
│  The engine — scan, patch, register, backup     │
├─────────────────────────────────────────────────┤
│                   Scripts                        │
│  bash + Node.js                                  │
│  Standalone — works without Claude Code running  │
│  install.sh · doctor.js · smoke-test.js         │
└─────────────────────────────────────────────────┘
```

### Plugin Layer (`plugin/`)

Markdown files that Claude Code interprets at runtime. No executable code — the plugin is pure prompt engineering. Each command declares which MCP tools it's allowed to call, then describes the workflow in natural language.

- **Commands** (`plugin/commands/*.md`) — user-invokable via `/command-name`
- **Agents** (`plugin/agents/*.md`) — specialized subagents (scanner, repair, bootstrap) with model hints
- **Skills** (`plugin/skills/*/skill.md`) — reusable capabilities invoked by agents and commands

### MCP Server Layer (`mcp-server/`)

A TypeScript [MCP](https://modelcontextprotocol.io/) server that communicates via stdio. Claude Code spawns it as a child process and calls its tools. This is where all the real logic lives:

```
mcp-server/src/
├── scanner/       Read-only detection
│   ├── node-runtime.ts     Node version, nvm, PATH
│   ├── claude-config.ts    ~/.claude/ state
│   ├── mcp-registry.ts     VS Code + CLI MCP registrations
│   ├── plugin-state.ts     Installed plugins, schema validation
│   ├── project-layout.ts   .claude/, CLAUDE.md, .mcp.json
│   └── team-config.ts      curato-setup.json parsing + inheritance
│
├── patcher/       Mutating operations
│   ├── backup.ts           Timestamped backups (~/.curato-backups/)
│   ├── file-writer.ts      Create / append / overwrite with dry-run
│   ├── json-merger.ts      safeMerge (target wins, arrays unioned)
│   ├── mcp-registrar.ts    Register MCP server to settings.json
│   ├── mcp-remover.ts      Remove from all config files
│   └── skill-filter.ts     Enable/disable plugin skills
│
├── tools/         MCP tool definitions (21 tools)
│   ├── index.ts            Tool registry + dispatch
│   ├── scan.ts             scan_environment, check_node_runtime
│   ├── inspect.ts          inspect_user_setup, inspect_project_setup
│   ├── recommend.ts        recommend_setup (dry-run proposals)
│   ├── apply.ts            apply_setup, repair_setup
│   ├── team.ts             apply_team_setup
│   ├── mcp.ts              register_mcp_both, remove_mcp_server, ...
│   ├── plugin.ts           check_plugin_state, remove_plugin, ...
│   ├── chrome.ts           Chrome DevTools connector (3 tools)
│   ├── smoketest.ts        create_smoke_test_app, run_smoke_test
│   └── uninstall.ts        uninstall_curato
│
├── smoketest/     Smoke test scaffold + runner
├── utils/         Cross-platform helpers (platform.ts)
├── server.ts      CuratoMCPServer (MCP SDK wiring)
├── index.ts       Entry point
└── types.ts       All shared interfaces
```

### Scripts Layer (`scripts/`)

Standalone scripts that work without Claude Code running. Useful for CI, onboarding, and debugging when Claude Code itself is broken.

Each script has both a `.sh` (Unix) and `.js` (cross-platform) version:

| Script | Purpose |
|--------|---------|
| `install` | Build MCP server, register plugin, register MCP server |
| `doctor` | Standalone health check |
| `smoke-test` | Validation suite |
| `bootstrap-project` | Scaffold .claude/ in a new project |
| `init-team` | Apply team setup without Claude Code |
| `uninstall` | Full teardown |
| `register-mcp` | MCP registration helper |

## Data Flow

### Scan → Diagnose → Repair

```
User runs /doctor
    │
    ▼
scan_environment()
    │  Reads: ~/.claude/, .claude/, .mcp.json,
    │         node version, plugins, MCP registries
    │
    ▼
ScanReport { checks[], summary }
    │  Each check: { id, severity, fixable, fix? }
    │
    ▼
recommend_setup()
    │  Generates: RepairProposal[]
    │  Each proposal: { action, targetPath, before, after }
    │
    ▼
User confirms (or dryRun: true)
    │
    ▼
repair_setup()
    │  1. backupFile() → ~/.curato-backups/<timestamp>/
    │  2. Apply mutations (create, merge, append, register)
    │  3. Return RepairReport { applied[], backupDir }
```

### Team Setup

```
User runs /setup-team
    │
    ▼
readTeamConfig()
    │  Reads: ./curato-setup.json
    │  If "extends": fetches remote config from GitHub
    │  Merges: safeMerge(local, remote) — local wins
    │
    ▼
apply_team_setup()
    │  For each mcpServer:
    │    → register_mcp_both (user or project scope)
    │  For each plugin:
    │    → claude plugin install (if not installed)
    │    → applySkillFilter (if skills config present)
    │  For claudeMd:
    │    → create-if-missing or append-if-missing-section
    │
    ▼
RepairReport { proposals[], applied[], backupDir }
```

## Design Decisions

### Why an MCP Server?

Claude Code natively speaks MCP. By exposing Curato's capabilities as MCP tools, every feature is available both through the plugin (conversational) and programmatically (via any MCP client). The plugin layer is just a UX wrapper — the MCP server is the API.

### Why Two Registries?

Claude Code has two separate MCP configuration paths:
- **VS Code extension**: `~/.claude/settings.json`
- **CLI**: `~/.claude.json`

They don't share state. If you register an MCP server in one, it's invisible to the other. Curato's `register_mcp_both` tool handles this by writing to both simultaneously.

### Why safeMerge?

Configuration files accumulate state from multiple sources (user, team, Curato, other tools). Deleting keys is dangerous — you might remove something another tool depends on. `safeMerge` is additive-only:

- Target (existing config) keys always win
- Source (new config) keys are added if missing
- Arrays are unioned with deduplication
- Neither input is mutated

This means Curato can only add to your config, never break it.

### Why Backup Before Every Write?

Every mutation creates a timestamped snapshot in `~/.curato-backups/`. If something goes wrong, you can restore any file to its exact state before Curato touched it. This is non-negotiable — there is no code path that writes a config file without backing it up first.

### Why Dry-Run Is Explicit?

Every tool that mutates state requires `dryRun: boolean` as a parameter. There is no default. The caller must consciously choose. When `dryRun: true`, the tool returns exactly what it would do (proposals with before/after diffs) without touching the filesystem.

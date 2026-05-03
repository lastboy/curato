# Curato

## Overview

Curato is a Claude Code plugin + Node.js CLI toolkit.
It installs plugins, registers MCP servers, scans environments, and applies team-wide config.

## Architecture

Two layers:
- `plugin/` — Claude Code plugin (13 commands, 3 agents, 2 skills)
- `cli/` — TypeScript CLI tool (`curato` binary) with 12 commands

## Commands

- `/doctor` — Full environment scan + interactive repair
- `/scan` — Quick status snapshot
- `/repair` — Apply repairs interactively
- `/bootstrap-project` — Scaffold .claude/ in a new project
- `/smoke-test` — Run 7-step validation suite
- `/setup-team` — Apply curato-setup.json team config
- `/connect-azure` — Register Azure DevOps MCP in both registries
- `/setup-chrome-devtools` — Install and configure chrome-devtools-mcp

## CLI

All plugin commands delegate to the `curato` CLI:

```bash
curato install <plugin> [--exclude skills] [--include skills]
curato uninstall <plugin>
curato setup [--config path] [--dry-run]
curato register-mcp <name> <command> [--args] [--env] [--scope]
curato remove-mcp <name> [--dry-run]
curato scan [--json]
curato clear-cache [--plugin name] [--dry-run]
```

## Stack

- Node.js >= 18 (tested on v24)
- TypeScript (strict, ESM, NodeNext modules)
- `tsx` for test runner
- Node built-in `node:test` for tests
- Zero runtime dependencies

## Key Invariants

1. **Never delete existing config keys** — all mutations use `safeMerge` (target wins)
2. **Backup before any write** — `backupFile()` creates `~/.curato-backups/<timestamp>/`
3. **dryRun is always explicit** — every mutating function requires `dryRun: boolean`
4. **Tests never touch `~/.claude`** — all tests use `mkdtemp` temp directories

## Contributing

All changes must go through a git PR:
1. Create a feature branch: `git checkout -b feat/<short-description>`
2. Make changes, build, run tests
3. Push and open a PR against `main`
4. Never commit directly to `main`

## Development

```bash
cd cli
npm install
npm run build        # compile TypeScript
npm run test         # run all tests
npm run test:unit    # scanner + patcher unit tests only
npm run test:integration  # regression suite
```

## File Layout

```
cli/src/
  types.ts           # all shared interfaces
  cli/               # CLI entry point + 7 commands
  scanner/           # read-only scan logic
  patcher/           # mutating operations
  utils/             # cross-platform helpers
  __tests__/         # unit + integration tests
```

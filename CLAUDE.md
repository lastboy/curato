# Curato

## Overview

Curato is a Claude Code plugin + Node TypeScript MCP server + shell scripts toolkit.
It scans, diagnoses, and repairs Claude Code developer environments.

## Architecture

Three layers:
- `plugin/` — Claude Code plugin (commands, agents, skills)
- `mcp-server/` — TypeScript stdio MCP server (21 tools)
- `scripts/` — Standalone shell scripts (no Claude Code dependency)

## Commands

- `/doctor` — Full environment scan + interactive repair
- `/scan` — Quick status snapshot
- `/repair` — Apply repairs interactively
- `/bootstrap-project` — Scaffold .claude/ in a new project
- `/smoke-test` — Run 7-step validation suite

## Stack

- Node.js >= 18 (tested on v24)
- TypeScript (strict, ESM, NodeNext modules)
- `@modelcontextprotocol/sdk` for MCP server
- `tsx` for test runner
- Node built-in `node:test` for tests

## Key Invariants

1. **Never delete existing config keys** — all mutations use `safeMerge` (target wins)
2. **Backup before any write** — `backupFile()` creates `~/.curato-backups/<timestamp>/`
3. **dryRun is always explicit** — `apply_setup` and `repair_setup` require `dryRun: boolean`
4. **Tests never touch `~/.claude`** — all tests use `mkdtemp` temp directories

## Contributing

All changes to the curato project must go through a git PR:
1. Create a feature branch: `git checkout -b feat/<short-description>`
2. Make changes, build, run tests
3. Push and open a PR against `main`
4. Never commit directly to `main`

## Development

```bash
cd mcp-server
npm install
npm run build        # compile TypeScript
npm run test         # run all tests
npm run test:unit    # scanner + patcher + tool unit tests only
npm run test:integration  # server roundtrip + regression suite
```

## File Layout

```
mcp-server/src/
  types.ts           # all shared interfaces
  server.ts          # CuratoMCPServer (MCP SDK wiring)
  index.ts           # entry point
  tools/             # MCP tool implementations
  scanner/           # read-only scan logic
  patcher/           # mutating operations
  smoketest/         # smoke test scaffold + runner
  __tests__/         # unit + integration tests
```

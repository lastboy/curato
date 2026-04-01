# Curato Plugin

Claude Code plugin providing environment scanning, repair, and smoke-testing.

## Commands

| Command | Description |
|---------|-------------|
| `/doctor` | Full environment health check with optional repair |
| `/scan` | Quick status snapshot (read-only) |
| `/repair` | Interactive repair workflow |
| `/bootstrap-project` | Scaffold `.claude/` and `CLAUDE.md` in a new project |
| `/smoke-test` | Run 7-step validation suite |

## Agents

| Agent | Model | Description |
|-------|-------|-------------|
| `scanner-agent` | sonnet | Runs all scan tools, returns consolidated JSON |
| `repair-agent` | sonnet | scan → recommend → confirm → apply workflow |
| `bootstrap-agent` | haiku | Fast project scaffolding |

## Install

```bash
bash /path/to/curato/scripts/install.sh
```

Then verify:

```bash
bash /path/to/curato/scripts/doctor.sh
```

Or in Claude Code: `/doctor`

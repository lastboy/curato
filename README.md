# Curato

**A CLI that sets up your Claude Code environment — not an MCP server.**

Curato installs plugins, registers MCP servers, filters which skills are active, and applies team-wide config. It runs only when you call it — no background process, no tool schemas in your context window.

> **Why CLI instead of MCP?**
> The old Curato ran as an MCP server, injecting ~21 tool schemas into every session before you typed a word (~4,000–6,000 tokens wasted per session). This version is a plain CLI: zero token cost at startup, runs only on demand.

## What it does

- **Installs and uninstalls Claude Code plugins**
- **Filters plugin skills** — disable the ones you don't use to save context tokens at startup
- **Registers MCP servers** (Azure DevOps, Chrome DevTools, etc.) in both VS Code and CLI registries
- **Applies team config** from a single `curato-setup.json` — one command to standardize every developer's setup
- **Scans and repairs** your environment when things break

## The Problem

MCP servers break. Node versions mismatch. VS Code and CLI have separate registries that don't sync. Plugins load every skill into context even if you never use them. Every developer on your team has a different Claude Code setup. There's no `package.json` for your Claude Code environment — until now.

## Prerequisites

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed

---

## Quick Start

```bash
# 1. Install curato globally
npm install -g curato

# 2. Create a curato-setup.json in your project (see Config Reference below)
#    then apply it
curato setup

# 3. Verify everything is wired up
curato scan
```

Reload Claude Code after setup. That's it.

> **Optional:** `curato install curato` installs slash commands (`/doctor`, `/scan`, `/setup-team`) directly inside Claude Code chat. Not required — the CLI works standalone.

### Example: Chrome DevTools

Add this to your `curato-setup.json` to let Claude control your browser:

```json
{
  "version": 1,
  "mcpServers": {
    "chrome-devtools": {
      "command": "chrome-devtools-mcp",
      "args": ["--browserUrl", "http://127.0.0.1:9222"],
      "scope": "user",
      "enabled": true
    }
  }
}
```

```bash
curato setup        # registers the MCP server
curato launch-chrome  # starts Chrome in debug mode
```

Then in a Claude Code session, ask: *"take a screenshot"* or *"click the login button"* — Claude will control the browser directly. No extra configuration needed.

---

## CLI Reference

### `curato install <plugin>`

Install a Claude Code plugin with optional skill filtering.

```
OPTIONS
  --exclude <skills>   Comma-separated skill names to disable
  --include <skills>   Comma-separated skill names to keep enabled (all others disabled)
  --dry-run            Preview without applying

EXAMPLES
  curato install superpowers
  curato install superpowers --exclude writing-skills,subagent-driven-development
  curato install superpowers --include brainstorming,systematic-debugging
```

`--exclude` and `--include` are mutually exclusive strategies:
- `--exclude` disables named skills, keeps everything else
- `--include` keeps only named skills, disables everything else

Disabled skills are renamed `.skill.md.disabled` in the plugin cache — Claude Code skips them at startup, saving context tokens.

---

### `curato uninstall <plugin>`

Uninstall a Claude Code plugin.

```
EXAMPLES
  curato uninstall superpowers
```

---

### `curato setup`

Apply a `curato-setup.json` config file. Registers MCP servers, installs plugins with skill filters, installs shell-env LaunchAgent, and writes CLAUDE.md content.

```
OPTIONS
  --config <path>   Path to curato-setup.json (default: ./curato-setup.json)
  --dry-run         Preview changes without applying them

EXAMPLES
  curato setup
  curato setup --config ./team/curato-setup.json
  curato setup --dry-run
```

### `curato teardown`

Reverse everything `curato setup` applied from the same config. Uninstalls plugins, removes MCP servers, removes marketplaces, removes the shell-env LaunchAgent. CLAUDE.md appends are skipped (not safely reversible — revert manually from `~/.curato-backups/` if needed).

```
OPTIONS
  --config <path>   Path to curato-setup.json (default: ./curato-setup.json)
  --dry-run         Preview removals

EXAMPLES
  curato teardown
  curato teardown --dry-run
```

**What it does:**
1. Reads and validates `curato-setup.json`
2. Registers each enabled MCP server in both VS Code (`~/.claude/settings.json`) and CLI (`~/.claude.json`) registries
3. Installs each enabled plugin via `claude plugin install`, then applies skill filters
4. Writes CLAUDE.md content to project or user scope (based on config)

Environment variables in `env` values (e.g. `${ADO_MCP_AUTH_TOKEN}`) are **not written to disk**. `curato setup` skips any env entry that contains a `${VAR}` reference — the MCP server will inherit the variable from the shell at spawn time instead. **Launch Claude Code from a terminal where those variables are set** (e.g. `.zshrc` exports) — not from VS Code tasks or GUI launchers that don't source your shell init.

---

### `curato register-mcp <name> <command>`

Register an MCP server in both VS Code and CLI registries (user scope) or in `.mcp.json` (project scope).

```
OPTIONS
  --args <a,b,c>     Comma-separated CLI arguments for the server
  --env KEY=VAL      Environment variable (repeatable)
  --scope            user (default) or project
  --dry-run          Preview without applying

EXAMPLES
  curato register-mcp azure-devops npx \
    --args "-y,azure-devops-mcp-server,MyOrg,-d,repositories,work-items,--authentication,envvar" \
    --env ADO_MCP_AUTH_TOKEN=mytoken

  curato register-mcp my-local-server node \
    --args "/path/to/server.js" \
    --scope project
```

User scope registers in both `~/.claude/settings.json` (VS Code extension) and `~/.claude.json` (Claude Code CLI). Project scope writes to `.mcp.json` in the current directory.

---

### `curato remove-mcp <name>`

Remove an MCP server from all registries.

```
OPTIONS
  --dry-run   Preview without applying

EXAMPLES
  curato remove-mcp azure-devops
  curato remove-mcp my-server --dry-run
```

Searches `~/.claude/settings.json`, `~/.claude.json`, `settings.local.json`, and `.mcp.json`.

---

### `curato scan`

Snapshot of the current Claude Code environment. Read-only — makes no changes.

```
OPTIONS
  --json    Output raw JSON (machine-readable)

EXAMPLE OUTPUT
  ✓  Node.js runtime                 v22.14.0
  ✓  Claude settings.json            /Users/you/.claude/settings.json
  ○  User CLAUDE.md                  not found
  ✓  MCP servers registered          azure-devops, chrome-devtools
  ✓  Plugins installed               superpowers
  ○  Project .claude/ dir            not found (use /bootstrap-project in Claude Code)
```

---

### `curato clear-cache`

Delete plugin cache directories. Forces Claude Code to re-download plugins on next launch.

```
OPTIONS
  --plugin <name>       Only clear cache for this plugin
  --marketplace <name>  Only clear cache for this marketplace
  --dry-run             Preview without deleting

EXAMPLES
  curato clear-cache
  curato clear-cache --plugin superpowers
  curato clear-cache --dry-run
```

---

### `curato install-shell-env` (macOS)

Install a LaunchAgent that forwards named shell env vars (from `~/.zshrc` by default) into launchd at login, so GUI-launched apps see them. Solves the "MCP works in terminal, fails in VS Code from Dock" issue without storing token values on disk.

```
OPTIONS
  --var <NAME>           Env var name to forward (repeatable)
  --source-file <path>   Shell startup file. Default: ~/.zshrc
  --config [path]        Read var list from curato-setup.json (default: ./curato-setup.json)
  --dry-run              Print the generated plist without writing

EXAMPLES
  curato install-shell-env --var ADO_MCP_AUTH_TOKEN
  curato install-shell-env --var ADO_MCP_AUTH_TOKEN --var GITHUB_TOKEN
  curato install-shell-env --config
  curato install-shell-env --dry-run --var X
```

The plist contains **var names only** — values are read from your shell file at login.

After install: quit and relaunch VS Code (GUI apps cache env at launch time).

---

### `curato uninstall-shell-env` (macOS)

Remove the LaunchAgent and unset the forwarded launchd vars.

```
OPTIONS
  --keep-vars   Don't call launchctl unsetenv
  --dry-run     Preview without removing

EXAMPLES
  curato uninstall-shell-env
  curato uninstall-shell-env --dry-run
```

Does not modify your `.zshrc` — only removes what `install-shell-env` created.

---

## curato-setup.json Reference

A `curato-setup.json` defines your team's complete Claude Code environment. Run `curato setup` to apply it.

### Full schema

```json
{
  "version": 1,

  "shellEnv": {
    "vars": ["ADO_MCP_AUTH_TOKEN", "GITHUB_TOKEN"],
    "sourceFile": "~/.zshrc",
    "enabled": true
  },

  "mcpServers": {
    "<server-name>": {
      "command": "string — the executable to run",
      "args": ["array", "of", "CLI", "arguments"],
      "env": {
        "KEY": "literal — or ${ENV_VAR} (not written to disk; inherited at runtime)"
      },
      "scope": "user | project",
      "enabled": true
    }
  },

  "plugins": [
    "plugin-name",
    {
      "name": "plugin-name",
      "enabled": true,
      "skills": {
        "include": ["skill-a", "skill-b"]
      }
    }
  ],

  "claudeMd": {
    "project": {
      "mode": "create-if-missing | overwrite | append-if-missing-section",
      "section": "optional marker string for dedup",
      "content": "text to write"
    },
    "user": {
      "mode": "create-if-missing | overwrite | append-if-missing-section",
      "section": "optional marker string for dedup",
      "content": "text to write"
    }
  }
}
```

> **Note on `skills`:** `include` and `exclude` are mutually exclusive — pick one per plugin, not both. See "Field details" below.

### Field details

**`shellEnv`** (macOS only)

Install a LaunchAgent that forwards named shell env vars into launchd at login time, so GUI-launched apps (VS Code from Dock, Claude Code from Spotlight) inherit them. Solves the common "MCP auth works in terminal but fails in GUI" problem.

| Field | Type | Description |
|-------|------|-------------|
| `vars` | string[] | Env var names to forward (e.g. `["ADO_MCP_AUTH_TOKEN"]`). Values are read from `sourceFile` at login, not stored in the plist. |
| `sourceFile` | string | Shell file to source. Default: `~/.zshrc`. |
| `enabled` | boolean | Set `false` to skip. Default: `true`. |

`curato setup` auto-installs the LaunchAgent when this block is present. Standalone: `curato install-shell-env --var NAME` / `curato uninstall-shell-env`. Linux/Windows skip this block (platform-specific mechanisms not yet supported).

**`mcpServers`**

Each key is the server name as it appears in Claude Code's registry.

| Field | Type | Description |
|-------|------|-------------|
| `command` | string | Executable — `npx`, `node`, an absolute path, etc. |
| `args` | string[] | CLI arguments passed to the command |
| `env` | object | Environment variables. Values support `${VAR}` expansion at `curato setup` run time. |
| `scope` | `"user"` \| `"project"` | `user` → both VS Code and CLI registries. `project` → `.mcp.json` in current directory. |
| `enabled` | boolean | Set `false` to skip without removing the entry. Default: `true`. |

**`plugins`**

Each entry is either a plain string (plugin name) or an object with options.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Plugin name as published (e.g. `superpowers`) |
| `enabled` | boolean | Set `false` to skip. Default: `true`. |
| `skills.include` | string[] | Keep only these skills. All others are disabled. Mutually exclusive with `exclude`. |
| `skills.exclude` | string[] | Disable these skills. All others stay enabled. Mutually exclusive with `include`. |

Disabled skills save startup context tokens — they are renamed `.disabled` in the cache rather than deleted, so you can re-enable them without reinstalling.

**`claudeMd`**

Write content into CLAUDE.md at project or user scope.

| Mode | Behavior |
|------|----------|
| `create-if-missing` | Write only if CLAUDE.md doesn't exist yet |
| `overwrite` | Always write (backs up existing file first) |
| `append-if-missing-section` | Append `content` unless `section` string is already present |

### Example

```json
{
  "version": 1,

  "shellEnv": {
    "vars": ["ADO_MCP_AUTH_TOKEN"]
  },

  "mcpServers": {
    "azure-devops": {
      "command": "mcp-server-azuredevops",
      "args": [
        "MyOrg",
        "-d", "repositories", "work-items", "wiki",
        "--authentication", "envvar"
      ],
      "env": {
        "ADO_MCP_AUTH_TOKEN": "${ADO_MCP_AUTH_TOKEN}"
      },
      "scope": "user",
      "enabled": true
    },
    "chrome-devtools": {
      "command": "chrome-devtools-mcp",
      "args": ["--browserUrl", "http://127.0.0.1:9222"],
      "scope": "user",
      "enabled": false
    }
  },

  "plugins": [
    {
      "name": "superpowers",
      "enabled": true,
      "skills": {
        "exclude": [
          "writing-skills",
          "subagent-driven-development",
          "receiving-code-review",
          "using-git-worktrees",
          "finishing-a-development-branch"
        ]
      }
    }
  ],

  "claudeMd": {
    "project": {
      "mode": "append-if-missing-section",
      "section": "## Team Standards",
      "content": "## Team Standards\n\nUse conventional commits. All PRs need a test plan."
    }
  }
}
```

### Environment variable handling

**Curato does not write environment variable values to disk.** Any `env` value containing a `${VAR}` reference is **skipped during registration** — the MCP server inherits it from the shell at spawn time instead. This keeps secrets (PATs, API keys) out of `~/.claude/settings.json`.

The practical consequence: **launch Claude Code from a terminal whose shell has those variables set** (typically via `.zshrc` / `.bashrc` exports). Tasks, GUI launchers, or CI steps that don't source your shell init won't have the vars, so the MCP auth will fail.

For CI, set vars explicitly on the Claude launch command:
```bash
ADO_MCP_AUTH_TOKEN=xxx claude
```

If you genuinely want a value written to disk (not recommended for secrets), use a literal string — no `${...}` — in your `curato-setup.json` and it will be written as-is.

---

## Claude Code Plugin Commands

Once Curato is installed as a plugin (`curato install curato`), these slash commands are available inside Claude Code:

| Command | What it does |
|---------|-------------|
| `/doctor` | Full health check — scans Node, plugins, MCP servers, project setup. Offers to repair. |
| `/scan` | Read-only status snapshot. No changes, no prompts. |
| `/repair` | Interactive repair for broken setups. |
| `/setup-team` | Apply your team's `curato-setup.json` |
| `/bootstrap-project` | Scaffold `.claude/` and `CLAUDE.md` in a new project |
| `/remove-mcp` | Remove an MCP server from all registries |
| `/remove-plugin` | Uninstall a plugin and clear its cache |
| `/clear-cache` | Clean plugin cache — one plugin, one marketplace, or everything |
| `/uninstall` | Full teardown — removes Curato and everything it installed |
| `/connect-azure` | Register Azure DevOps MCP with proper auth in both registries |
| `/setup-chrome-devtools` | Install and configure chrome-devtools-mcp |
| `/connect-chrome` | Launch Chrome in debug mode and connect Claude |
| `/smoke-test` | 7-step validation suite |

Each command calls `curato <subcommand>` via Bash — no MCP server process required.

---

## Key Guarantees

1. **Never deletes existing config** — all merges use target-wins semantics
2. **Backup before every write** — timestamped copies in `~/.curato-backups/`
3. **`--dry-run` on every mutating command** — preview before you apply
4. **Tests never touch `~/.claude`** — all tests use temp directories

---

## Architecture

```
plugin/           → Claude Code plugin (13 commands, 3 agents, 2 skills)
cli/              → Node.js CLI + library (pure TypeScript)
  src/cli/        → CLI entry point + 7 commands
  src/scanner/    → Read-only environment scanners
  src/patcher/    → Mutating operations (register, remove, merge, backup)
  src/types.ts    → Shared interfaces
```

The plugin provides the conversational UX in Claude Code. The CLI does the actual work. They are independent — you can use the CLI without the plugin, and the plugin calls the CLI via Bash.

---

## Development

```bash
cd cli
npm install
npm run build          # compile TypeScript → dist/
npm run test           # all tests
npm run test:unit      # scanner + patcher unit tests
npm run test:integration  # regression suite
```

See [cli/README.md](cli/README.md) for module internals, adding commands, and test conventions.

---

## Platform Support

- **macOS** — fully supported
- **Linux** — fully supported
- **Windows** — supported (uses `claude.cmd` binary, `%APPDATA%` paths)

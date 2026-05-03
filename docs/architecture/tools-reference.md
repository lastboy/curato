# CLI Reference

Curato exposes 7 commands via the `curato` CLI.

## `curato install <plugin>`

Install a Claude Code plugin with optional skill filtering.

| Option | Type | Description |
|--------|------|-------------|
| `--exclude <skills>` | string | Comma-separated skill names to disable |
| `--include <skills>` | string | Comma-separated skill names to keep (all others disabled) |
| `--dry-run` | flag | Preview without applying |

`--exclude` and `--include` are mutually exclusive. Disabled skills are renamed `.skill.md.disabled` in the plugin cache.

```bash
curato install superpowers
curato install superpowers --exclude writing-skills,subagent-driven-development
curato install superpowers --include brainstorming,systematic-debugging
curato install superpowers --dry-run
```

---

## `curato uninstall <plugin>`

Uninstall a Claude Code plugin via `claude plugin uninstall`.

```bash
curato uninstall superpowers
```

---

## `curato setup`

Apply a `curato-setup.json` config file. Registers MCP servers, installs plugins with skill filters, writes CLAUDE.md content.

| Option | Type | Description |
|--------|------|-------------|
| `--config <path>` | string | Path to config file (default: `./curato-setup.json`) |
| `--dry-run` | flag | Preview changes without applying |

```bash
curato setup
curato setup --config ./team/curato-setup.json
curato setup --dry-run
```

Environment variables in `env` values (e.g. `${ADO_MCP_AUTH_TOKEN}`) are expanded from `process.env` at run time. Run `curato setup` from a terminal where those variables are set.

---

## `curato register-mcp <name> <command>`

Register an MCP server in both VS Code (`~/.claude/settings.json`) and CLI (`~/.claude.json`) registries, or in `.mcp.json` for project scope.

| Option | Type | Description |
|--------|------|-------------|
| `--args <a,b,c>` | string | Comma-separated CLI arguments |
| `--env KEY=VAL` | string (repeatable) | Environment variable |
| `--scope` | `user` \| `project` | Registry target (default: `user`) |
| `--dry-run` | flag | Preview without applying |

```bash
curato register-mcp azure-devops npx \
  --args "-y,azure-devops-mcp-server,MyOrg,-d,repositories,work-items,--authentication,envvar" \
  --env ADO_MCP_AUTH_TOKEN=mytoken

curato register-mcp local-server node \
  --args "./server.js" \
  --scope project
```

---

## `curato remove-mcp <name>`

Remove an MCP server from all registries (`settings.json`, `.claude.json`, `settings.local.json`, `.mcp.json`).

| Option | Type | Description |
|--------|------|-------------|
| `--dry-run` | flag | Preview without applying |

```bash
curato remove-mcp azure-devops
curato remove-mcp my-server --dry-run
```

---

## `curato scan`

Snapshot of the current Claude Code environment. Read-only — no changes.

| Option | Type | Description |
|--------|------|-------------|
| `--json` | flag | Output raw JSON (machine-readable) |

```bash
curato scan
curato scan --json
```

**Output:**

```
Curato — environment scan

✓  Node.js runtime                 v22.14.0
✓  Claude settings.json            /Users/you/.claude/settings.json
○  User CLAUDE.md                  not found
✓  MCP servers registered          azure-devops, chrome-devtools
✓  Plugins installed               superpowers
○  Project .claude/ dir            not found (use /bootstrap-project in Claude Code)

5 ok, 2 missing
```

**JSON output schema:**

```json
{
  "checks": [
    { "id": "node-runtime", "label": "Node.js runtime", "status": "ok", "detail": "v22.14.0" }
  ],
  "counts": { "ok": 4, "warn": 0, "error": 0, "missing": 2 }
}
```

---

## `curato clear-cache`

Delete plugin cache directories. Forces Claude Code to re-download plugins on next launch.

| Option | Type | Description |
|--------|------|-------------|
| `--plugin <name>` | string | Only clear cache for this plugin |
| `--marketplace <name>` | string | Only clear cache for this marketplace |
| `--dry-run` | flag | Preview without deleting |

```bash
curato clear-cache
curato clear-cache --plugin superpowers
curato clear-cache --dry-run
```

Cache location: `~/.claude/plugins/cache/<marketplace>/<plugin>/`

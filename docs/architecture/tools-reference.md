# MCP Tools Reference

Curato exposes 21 MCP tools organized into five groups.

## Scanning & Diagnosis

Tools that read environment state without modifying anything.

### `scan_environment`
Full environment scan. Returns a `ScanReport` with checks for Node runtime, user setup, project layout, plugins, and MCP registrations.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cwd` | string | process.cwd() | Project directory to scan |
| `scope` | `"user"` \| `"project"` \| `"full"` | `"full"` | What to scan |

### `inspect_user_setup`
Returns `UserSetupInfo` — the state of `~/.claude/`, installed plugins, and user-level CLAUDE.md.

No parameters.

### `inspect_project_setup`
Returns `ProjectLayoutInfo` — whether `.claude/`, `CLAUDE.md`, `.mcp.json`, agents, commands, and skills exist in the project.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cwd` | string | process.cwd() | Project directory |

### `check_node_runtime`
Returns `NodeRuntimeInfo` — Node version, npm version, nvm state, PATH analysis.

No parameters.

### `check_mcp_registration`
Scans both VS Code and CLI registries for MCP server entries. Reports binary resolvability.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `serverName` | string | _(all)_ | Filter to one server |
| `cwd` | string | process.cwd() | Project directory (for .mcp.json) |

## Repair & Configuration

Tools that modify the environment. All require explicit `dryRun` parameter.

### `recommend_setup`
Generates `RepairProposal[]` for fixable issues. Does not apply them.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cwd` | string | process.cwd() | Project directory |
| `goals` | string[] | _(all)_ | Filter proposals by goal |

### `apply_setup`
Applies all fixable issues. Backs up files before writing.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cwd` | string | process.cwd() | Project directory |
| `dryRun` | boolean | **required** | If true, returns proposals without applying |
| `targets` | string[] | _(all)_ | Specific check IDs to fix |

### `repair_setup`
Applies specific repairs by check ID.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `checkIds` | string[] | **required** | Check IDs from ScanReport |
| `cwd` | string | process.cwd() | Project directory |
| `dryRun` | boolean | **required** | If true, returns proposals without applying |

### `register_mcp_both`
Registers an MCP server in both VS Code (`~/.claude/settings.json`) and CLI (`~/.claude.json`) registries simultaneously.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `serverName` | string | **required** | Server name |
| `command` | string | **required** | Binary path or command |
| `args` | string[] | [] | Command arguments |
| `env` | object | {} | Environment variables |
| `dryRun` | boolean | **required** | If true, returns proposal |

### `remove_mcp_server`
Removes an MCP server from all registries (VS Code, CLI, project `.mcp.json`).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `serverName` | string | **required** | Server name |
| `dryRun` | boolean | **required** | If true, returns proposal |

## Plugin Management

### `check_plugin_state`
Validates installed plugins — checks `plugin.json` schema, version, and directory structure.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pluginName` | string | _(all)_ | Filter to one plugin |

### `remove_plugin`
Uninstalls a plugin and clears its cache.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pluginName` | string | **required** | Plugin to remove |
| `dryRun` | boolean | **required** | If true, returns proposal |

### `clear_plugin_cache`
Clears plugin cache — one plugin, one marketplace, or everything.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pluginName` | string | _(all)_ | Clear one plugin's cache |
| `marketplaceName` | string | _(all)_ | Clear one marketplace |
| `dryRun` | boolean | **required** | If true, returns proposal |

## Team Setup

### `apply_team_setup`
Reads `curato-setup.json`, resolves inheritance (`extends`), and applies the team standard: MCP servers, plugins, skill filters, and CLAUDE.md content.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `configPath` | string | `./curato-setup.json` | Config file path |
| `cwd` | string | process.cwd() | Project directory |
| `dryRun` | boolean | **required** | If true, returns proposal |

## Built-in Connectors

### Chrome DevTools

#### `check_chrome_devtools`
Checks if chrome-devtools-mcp is installed and registered.

#### `setup_chrome_devtools`
Installs chrome-devtools-mcp, registers in both MCP registries, creates the debug launcher script.

#### `launch_chrome_debug`
Launches Chrome with remote debugging enabled on port 9222.

### Azure DevOps

#### `launch_azure_auth`
Forces re-authentication of the Azure DevOps MCP server by killing the stale process.

## Smoke Testing

### `create_smoke_test_app`
Scaffolds a minimal test fixture with `package.json` and `CLAUDE.md`.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `targetDir` | string | **required** | Directory to create fixture in |

### `run_smoke_test`
Runs 7-step validation: node reachable, server built, plugin readable, doctor command exists, MCP round-trip, scan returns data, fixture cleanup.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fixtureDir` | string | `smoke-test-fixture/` | Fixture directory |

## Full Teardown

### `uninstall_curato`
Removes all plugins installed by Curato, removes all MCP server registrations, clears all plugin caches.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `dryRun` | boolean | **required** | If true, returns proposal |

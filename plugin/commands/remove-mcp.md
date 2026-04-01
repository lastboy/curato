---
description: Remove an MCP server from all Claude Code registries (CLI + VS Code).
argument-hint: "<server-name> [--dry-run]"
allowed-tools: ["mcp__curato__remove_mcp_server", "AskUserQuestion"]
---

You are removing an MCP server. 

## Step 0: Pre-flight
Check `remove_mcp_server` tool is available. If not, output error and STOP.

## Step 1: Parse args
Get server name from $ARGUMENTS. If missing, ask: "Which MCP server should Curato remove?"

Check for `--dry-run` flag in $ARGUMENTS.

## Step 2: Dry run
Call `remove_mcp_server` with `serverName: <name>` and `dryRun: true`.

Show what will be removed:
- "Will remove from CLI registry (~/.claude.json)" if found there
- "Will remove from VS Code registry (~/.claude/settings.json)" if found there
- "Not found in either registry" if notFound has both

If not found anywhere, output: "Curato: No MCP server named '<name>' found in any registry." and STOP.

## Step 3: Confirm
Ask: "Remove '<name>' from N registry/registries? (yes/no)"

If no: STOP.

## Step 4: Apply
Call `remove_mcp_server` with `dryRun: false`.

## Step 5: Report
Output:
```
Removed '<name>'.
  ✓ Removed from: <list>
  Backup: <backupDir>

Reload your Claude Code window to disconnect the server.
```

---
description: Remove an MCP server from all Claude Code registries (CLI + VS Code).
argument-hint: "<server-name> [--dry-run]"
allowed-tools: ["Bash", "AskUserQuestion"]
---

## Step 1: Get server name

If `$ARGUMENTS` is non-empty, use it as the server name.
If empty, ask: "Which MCP server should Curato remove?"

## Step 2: Dry run

Run: `npx -y curato remove-mcp <name> --dry-run 2>&1`

Show what will be removed. If not found anywhere, output:
`Curato: No MCP server named '<name>' found in any registry.` and STOP.

## Step 3: Confirm

Ask: "Remove '<name>'? (yes/no)"

If no: STOP.

## Step 4: Apply

Run: `npx -y curato remove-mcp <name> 2>&1`

## Step 5: Report

Show the output. Then:
`Reload your Claude Code window to disconnect the server.`

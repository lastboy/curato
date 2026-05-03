---
description: Full teardown — uninstall all plugins, remove curato MCP server, and clear all plugin caches.
allowed-tools: ["Bash", "AskUserQuestion"]
---

## Step 1: Dry run

Run: `curato scan 2>&1` to show current state.

Present a summary of what will be removed.

## Step 2: Confirm

Ask exactly:
"This will uninstall all plugins and remove the curato MCP server. Type CONFIRM to proceed or anything else to cancel."

If the user does NOT type exactly `CONFIRM` (case-sensitive):
Output: `Curato: Aborted. No changes made.` and STOP.

## Step 3: Remove plugins

Run: `curato clear-cache 2>&1`

For each plugin shown in the scan, run: `curato uninstall <plugin-name> 2>&1`

## Step 4: Remove curato MCP server

Run: `curato remove-mcp curato 2>&1`

## Step 5: Report

Show all output.

`Reload your Claude Code window. Run /doctor to verify the environment is clean.`

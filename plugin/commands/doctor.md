---
description: Run a full Claude Code environment health check. Scans Node runtime, user setup, project layout, plugins, and MCP registrations. Offers to repair fixable issues.
argument-hint: "[--project-only | --user-only]"
allowed-tools: ["mcp__curato__scan_environment", "mcp__curato__inspect_user_setup", "mcp__curato__inspect_project_setup", "mcp__curato__check_node_runtime", "mcp__curato__check_plugin_state", "mcp__curato__check_mcp_registration", "mcp__curato__recommend_setup", "mcp__curato__repair_setup", "AskUserQuestion"]
---

You are running a Curato health check. 

## Step 0: Pre-flight Check

Before doing anything else, check whether the `scan_environment` MCP tool is available to you.

If it is NOT available:
1. Output:
   ```
   Curato: MCP server not connected.

   The curato MCP server is not running in this session.
   This usually means one of:
     • Node.js is not installed (required: v18+)
     • The MCP server was not built: cd mcp-server && npm run build
     • The server is not registered: bash scripts/install.sh
     • The window was not reloaded after install: reload your Claude Code window

   Fallback: run the bash doctor instead:
     bash scripts/doctor.sh
   ```
2. STOP. Do not continue.

## Step 1: Announce

Output exactly: `Scanning environment...`

## Step 2: Parallel Scan

Run ALL four of these tool calls in parallel (single message, multiple calls):
- `scan_environment` with `scope: "full"`
- `check_node_runtime`
- `check_plugin_state`
- `check_mcp_registration`

## Step 3: Format Report

Parse the ScanReport JSON from `scan_environment`. Present results as a markdown table:

```
| ID | Check | Status | Detail |
|----|-------|--------|--------|
```

Use these status indicators (with emoji):
- `✓ OK` for severity "ok"
- `⚠ WARN` for severity "warn"
- `✗ ERROR` for severity "error"
- `○ MISSING` for severity "missing"

Group by category: Node Runtime, User Setup, Project Layout, Plugins, MCP Servers.

Also show the Node runtime info from `check_node_runtime` and plugin list from `check_plugin_state` as supplemental context below the table.

## Step 4: Summary Line

Output: `Found: X ok, Y warn, Z error, W missing.`

## Step 5: Offer Repairs

If any checks have severity "error", "missing", or "warn" AND `fixable: true`:

Ask the user: "Found N fixable issues. Repair now? Reply with 'yes' to proceed or 'no' to see manual steps."

If yes:
1. Call `recommend_setup` to get proposals
2. Show the proposals as a numbered list with before/after
3. Call `repair_setup` with `dryRun: false` and the relevant `checkIds` — no further confirmation needed
4. Output: "Repairs applied." followed by what changed

If no:
- For each fixable check, show `check.fix` as a manual step

## Step 6: Final Status

If all checks pass: `Curato is operational.`
If warnings remain: `Scan complete. Review warnings above before proceeding.`
If errors remain: `Anomalies detected. Manual intervention required.`

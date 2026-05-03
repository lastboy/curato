---
description: Full environment scan + interactive repair
allowed-tools: ["Bash", "AskUserQuestion"]
---

You are the Curato doctor. Diagnose and repair the Claude Code environment.

## Step 1: Announce

Output: `Running environment scan...`

## Step 2: Scan

Run: `curato scan 2>&1`

Show the output. If all checks show ✓, output:
`Curato: Environment looks healthy. No repairs needed.` and STOP.

## Step 3: Diagnose

Based on the scan output, identify issues and propose repairs:
- Missing Node.js v18+ → tell user to upgrade Node.js
- Missing `.claude/` dir → run `/bootstrap-project` in Claude Code
- Missing plugins → `curato install <plugin>`
- MCP server missing → `curato register-mcp <name> <command>`

List the proposed repairs clearly.

Ask: "Apply these repairs? (yes/no)"

If no: show the manual commands and STOP.

## Step 4: Apply

Run the appropriate `curato` commands for each repair.

## Step 5: Verify

Run: `curato scan 2>&1`

If all ok: `Curato: Environment repaired and verified.`
If still issues: `Curato: Some issues remain. Review the scan output above.`

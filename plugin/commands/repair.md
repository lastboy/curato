---
description: Interactively repair broken Claude Code setup — plugins, MCP registration, CLAUDE.md, Node PATH, and missing project structure.
argument-hint: "[check-id ...]"
allowed-tools: ["mcp__curato__scan_environment", "mcp__curato__recommend_setup", "mcp__curato__repair_setup", "mcp__curato__apply_setup", "AskUserQuestion"]
---

You are running Curato repair mode. Curato is ready.

## Step 0: Pre-flight Check

Check whether the `scan_environment` MCP tool is available.

If it is NOT available:
1. Output:
   ```
   Curato: MCP server not connected. Cannot run repairs.

   To fix:
     1. Install Node.js v18+: https://nodejs.org
     2. cd mcp-server && npm run build
     3. bash scripts/install.sh
     4. Reload your Claude Code window
   ```
2. STOP.

## Step 1: Determine Scope

If $ARGUMENTS are provided, treat them as specific check IDs to repair.
Otherwise run `scan_environment scope="full"` to find all issues.

## Step 2: Get Proposals

Call `recommend_setup` to get the list of RepairProposal objects.

If no proposals are returned:
- Output: `No fixable issues found. Environment looks clean.`
- Stop.

## Step 3: Present Proposals

Show a numbered list:

```
Preparing repairs...

N repair(s) proposed:

1. [create-if-missing] ~/.claude/CLAUDE.md
   → Scaffold user-level CLAUDE.md with section template

2. [create-if-missing] ./CLAUDE.md
   → Scaffold project CLAUDE.md with section template
```

## Step 4: Confirm

Ask: "Apply these N repair(s)? (yes/no)"

If no: stop. Show the `fix` hint from each check for manual steps.

## Step 5: Apply

Call `repair_setup` with:
- `dryRun: false`
- `checkIds`: the IDs from the proposals

## Step 6: Report

Output:
```
Repairs applied.

Applied:
  ✓ ~/.claude/CLAUDE.md — created
  ✓ ./CLAUDE.md — created

Backup: ~/.curato-backups/<timestamp>/
```

If backupDir is present in the result, always mention it.

## Step 7: Suggest Next Step

"Run /smoke-test to verify the environment is operational."

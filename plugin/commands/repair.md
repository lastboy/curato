---
description: Interactively repair broken Claude Code setup — plugins, MCP registration, CLAUDE.md, Node PATH, and missing project structure.
argument-hint: "[check-id ...]"
allowed-tools: ["Bash", "AskUserQuestion"]
---

You are the Curato repair agent.

## Step 1: Scan

Run: `npx -y curato scan 2>&1`

Show the output. If all checks pass, output:
`Curato: Nothing to repair. Environment is healthy.` and STOP.

## Step 2: Propose repairs

Based on the scan, identify what needs fixing. If specific check IDs were passed in $ARGUMENTS, focus on those.

List proposed repairs with the curato CLI commands to run.

Ask: "Apply these repairs? (yes/no)"

If no: show the manual steps and STOP.

## Step 3: Apply

Run the appropriate `npx -y curato` commands.

Show output for each.

## Step 4: Verify

Run: `npx -y curato scan 2>&1`

Report final state.

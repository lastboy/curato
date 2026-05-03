---
description: Reverse everything curato setup applied (MCP servers, plugins, marketplaces, shell-env LaunchAgent) from the same curato-setup.json. claudeMd appends are skipped — not safely reversible.
argument-hint: "[--config path] [--dry-run]"
allowed-tools: ["Bash", "AskUserQuestion"]
---

## Step 1: Preview

Run: `npx -y curato teardown $ARGUMENTS --dry-run 2>&1`

Show the output. Note that `claudeMd` changes are NOT reverted by this command.

## Step 2: Confirm

Ask: "Apply this teardown? (yes/no)"

If no: STOP.

## Step 3: Apply

Run: `npx -y curato teardown $ARGUMENTS 2>&1`

## Step 4: Suggest reload

Output: `Teardown complete. Reload Claude Code (Cmd+Shift+P → Developer: Reload Window) for changes to take effect.`

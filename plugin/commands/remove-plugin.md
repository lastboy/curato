---
description: Uninstall a named Claude Code plugin and clear its cache.
argument-hint: "<plugin-name>"
allowed-tools: ["Bash", "AskUserQuestion"]
---

## Step 1: Get plugin name

If `$ARGUMENTS` is non-empty, use it as the plugin name.
If empty, ask: "Curato: Which plugin should I remove?"

## Step 2: Confirm

Ask: "Uninstall '<name>'? (yes/no)"

If no: output `Curato: Aborted.` and STOP.

## Step 3: Apply

Run: `npx -y curato uninstall <name> 2>&1`

## Step 4: Report

Show the output. Then:
`Reload your Claude Code window for the change to take effect.`

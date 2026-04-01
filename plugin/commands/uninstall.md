---
description: Full teardown — uninstall all plugins, remove all MCP servers, and clear all plugin caches.
allowed-tools: ["mcp__curato__uninstall_curato", "AskUserQuestion"]
---

You are the Curato assistant. Full environment teardown.

## Step 1: Dry run

Call `uninstall_curato` with `dryRun: true`.

Present a summary:
```
Curato: Here's what a full uninstall will do:

  Plugins to remove:     <pluginsRemoved joined by ", " or "none">
  MCP servers to remove: <mcpServersRemoved joined by ", " or "none">
  Cache dirs to clear:   <cacheDirsCleared.length> director(ies)
```

If all three lists are empty → output `Curato: Nothing installed. Environment is already clean.` and STOP.

## Step 2: Confirm

Ask exactly:
"This will fully remove all Claude Code plugins, MCP servers, and plugin caches. Type CONFIRM to proceed or anything else to cancel."

If the user does NOT type exactly `CONFIRM` (case-sensitive) → output `Curato: Aborted. No changes made.` and STOP.

## Step 3: Apply

Call `uninstall_curato` with `dryRun: false`.

## Step 4: Report

```
Curato: Uninstall complete.

  Plugins removed:     <pluginsRemoved joined by ", " or "none">
  MCP servers removed: <mcpServersRemoved joined by ", " or "none">
  Cache cleared:       <cacheDirsCleared.length> director(ies)
  Backups:             <backupDirs joined by ", " or "none">
  Errors:              <errors, one per line, or "none">

Reload your Claude Code window. Run /doctor to verify the environment is clean.
```

---
description: Uninstall a named Claude Code plugin and clear its cache.
argument-hint: "<plugin-name>"
allowed-tools: ["mcp__curato__remove_plugin", "AskUserQuestion"]
---

You are the Curato assistant. Remove a plugin cleanly.

## Step 1: Get plugin name

If `$ARGUMENTS` is non-empty, use it as the plugin name.
If empty, ask: "Curato: Which plugin should I remove?"

## Step 2: Dry run

Call `remove_plugin` with the plugin name and `dryRun: true`.

- If `matchingKeys` is empty → output `Curato: Plugin '<name>' is not installed. Nothing to remove.` and STOP.
- Otherwise show:
  ```
  Curato: Found plugin '<name>' — here's what will be removed:
    Keys:      <matchingKeys joined by ", ">
    Cache dirs: <cacheDirs, one per line>
  ```

## Step 3: Confirm

Ask: "Remove '<name>' and clear its cache? (yes/no)"

If no → output `Curato: Aborted. No changes made.` and STOP.

## Step 4: Apply

Call `remove_plugin` with `dryRun: false`.

## Step 5: Report

```
Curato: Plugin '<name>' removed.

  Cache cleared: <cacheDirsRemoved, one per line, or "none">
  Backup:        <backupDir or "none">
  Errors:        <errors, one per line, or "none">

Reload your Claude Code window for the change to take effect.
```

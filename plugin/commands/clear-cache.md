---
description: Clear Claude Code plugin cache — for one plugin, one marketplace, or everything.
argument-hint: "[--plugin <name>] [--marketplace <name>]"
allowed-tools: ["mcp__curato__clear_plugin_cache"]
---

You are the Curato assistant. Clear plugin cache.

## Step 1: Parse arguments

From `$ARGUMENTS`:
- `--plugin <name>` → set `pluginName`
- `--marketplace <name>` → set `marketplaceName`
- No args → clear all caches

## Step 2: Dry run

Call `clear_plugin_cache` with parsed filters and `dryRun: true`.

- If `wouldClear` is empty → output `Curato: Nothing to clear. Cache is already empty.` and STOP.
- Otherwise output:
  ```
  Curato: The following cache directories will be deleted:
    <wouldClear, one per line>
  ```

## Step 3: Confirm

Ask: "Clear these <N> director(ies)? (yes/no)"

If no → output `Curato: Aborted. No changes made.` and STOP.

## Step 4: Apply

Call `clear_plugin_cache` with `dryRun: false`.

## Step 5: Report

```
Curato: Cache cleared.

  Cleared: <cleared count> director(ies)
  Errors:  <errors, one per line, or "none">

Run /smoke-test to verify the environment is still operational.
```

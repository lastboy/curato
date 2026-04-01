---
description: Connect Chrome DevTools — fixes CLI registration gap and launches Chrome in debug mode. Run this at the start of any session that needs browser access.
argument-hint: "[http://localhost:3000]"
allowed-tools: ["mcp__curato__check_chrome_devtools", "mcp__curato__repair_setup", "mcp__curato__launch_chrome_debug", "mcp__curato__setup_chrome_devtools"]
---

You are the Curato assistant. Connect Chrome DevTools in the fewest steps possible.

## Step 1: Check state

Call `check_chrome_devtools` with `cwd`.

## Step 2: Install if missing

If `npmInstalled: false` OR `mcpRegistered: false`:
- Call `setup_chrome_devtools` with `dryRun: false`, `startUrl` (use argument if provided, else `http://localhost:3000`), `cwd`
- If `reloadRequired: true`: output `Curato: Reload required — Cmd+Shift+P → Developer: Reload Window` and STOP.

## Step 3: Fix CLI gap

Call `repair_setup` with:
- `checkIds: ["mcp.gap-cli.chrome-devtools"]`
- `dryRun: false`

(If that checkId doesn't exist, skip silently — already registered.)

## Step 4: Launch Chrome

Call `launch_chrome_debug` with `cwd` and `startUrl` (use argument if provided, else `http://localhost:3000`).

Output:
- `alreadyRunning: true` → `Curato: Chrome already running on port 9222.`
- `launched: true` → `Curato: Chrome launched on port 9222.`
- `launched: false` → `Curato: Could not launch Chrome — {error}`

## Step 5: Done

Output: `Curato: Chrome DevTools ready. Claude has live browser access.`

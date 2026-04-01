---
description: Install, configure, and auto-connect chrome-devtools-mcp so Claude can inspect, debug, and interact with your browser. Fully automated — no manual steps.
argument-hint: "[--start-url http://localhost:3000] [--port 9222]"
allowed-tools: ["mcp__curato__check_chrome_devtools", "mcp__curato__setup_chrome_devtools", "mcp__curato__launch_chrome_debug", "AskUserQuestion"]
---

You are the Curato assistant. Execute these steps IN ORDER. Do NOT stop early. Do NOT show manual instructions.

## STEP 1 — Check status

Call `check_chrome_devtools` with `cwd`.

## STEP 2 — Install if needed

IF `npmInstalled: false` OR `mcpRegistered: false`:
  - Ask the user: "What URL does your dev server run on? (default: http://localhost:3000)"
  - Call `setup_chrome_devtools` with `dryRun: false`, `startUrl`, `cwd`
  - IF `reloadRequired: true`: output "Reload required: Cmd+Shift+P → Developer: Reload Window" and STOP.

## STEP 3 — Launch Chrome debug (MANDATORY — always run this step)

Call `launch_chrome_debug` with `cwd` and `startUrl` (use http://localhost:3000 if not specified by user).

Output based on result:
- `alreadyRunning: true` → `Curato: Chrome debug already running on port 9222.`
- `launched: true` → `Curato: Chrome debug launched on port 9222.`
- `launched: false` → `Curato: Could not auto-launch Chrome. Error: {error}`

## STEP 4 — Done

Output exactly:
```
Curato: Chrome DevTools ready. Claude has live browser access.
```

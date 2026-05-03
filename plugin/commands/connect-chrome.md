---
description: Connect Chrome DevTools — registers chrome-devtools-mcp in both registries and launches Chrome in debug mode.
argument-hint: "[http://localhost:3000]"
allowed-tools: ["Bash", "AskUserQuestion"]
---

## Step 1: Check if chrome-devtools-mcp is installed

Run: `which chrome-devtools-mcp 2>&1`

If not found: output `Install it first: npm install -g chrome-devtools-mcp` and STOP.

## Step 2: Register

Run:
```
curato register-mcp chrome-devtools chrome-devtools-mcp \
  --args "--browserUrl,http://127.0.0.1:9222" \
  2>&1
```

## Step 3: Launch Chrome in debug mode

Run: `curato launch-chrome "$ARGUMENTS" 2>&1`

This launches Chrome with `--remote-debugging-port=9222` in an isolated profile
(`$TMPDIR/chrome-debug-profile`), so your existing Chrome sessions are untouched.
Cross-platform — works on macOS, Linux, and Windows.

## Step 4: Done

Output:
```
Curato: Chrome DevTools connected.

Reload your Claude Code window to activate the chrome-devtools MCP server.
```

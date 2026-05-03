---
description: Install, configure, and auto-connect chrome-devtools-mcp so Claude can inspect, debug, and interact with your browser.
argument-hint: "[--start-url http://localhost:3000] [--port 9222]"
allowed-tools: ["Bash", "AskUserQuestion"]
---

## Step 1: Install chrome-devtools-mcp globally

Run: `npm install -g chrome-devtools-mcp 2>&1`

## Step 2: Register

Run: `curato register-mcp chrome-devtools chrome-devtools-mcp --args "--browserUrl,http://127.0.0.1:9222" 2>&1`

## Step 3: Launch Chrome

Parse `--start-url` and `--port` from $ARGUMENTS (defaults: http://localhost:3000, 9222).

On macOS: `open -a "Google Chrome" --args --remote-debugging-port=<port> <start-url>`
On Linux: `google-chrome --remote-debugging-port=<port> <start-url> &`
On Windows: `start chrome --remote-debugging-port=<port> <start-url>`

## Step 4: Done

Output:
```
Curato: chrome-devtools-mcp installed and registered.

Reload your Claude Code window:  Cmd+Shift+P → Developer: Reload Window
```

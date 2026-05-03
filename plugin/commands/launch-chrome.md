---
description: Launch Chrome in remote-debugging mode for the chrome-devtools MCP. Uses an isolated profile, leaves your main Chrome untouched.
argument-hint: "[url]"
allowed-tools: ["Bash"]
---

Run: `curato launch-chrome "$ARGUMENTS" 2>&1`

If `$ARGUMENTS` is empty, the command defaults to `http://localhost:3000`.

Show the output as-is. No follow-up questions.

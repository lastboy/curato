---
description: Run a full Curato environment scan. Use this skill when you need to assess the current state of a developer's Claude Code setup before taking any action.
allowed-tools: ["Bash"]
---

## scan-environment skill

Run: `curato scan 2>&1`

Return the output with:
- Each check as a ✓ / ⚠ / ✗ / ○ line
- Summary counts: ok / warn / error / missing
- List of issues that need attention

Do not apply any fixes. Do not ask questions.

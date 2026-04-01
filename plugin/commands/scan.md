---
description: Quick snapshot of the current Claude Code environment status. No repairs, no prompts — just the facts.
allowed-tools: ["mcp__curato__scan_environment"]
---

Run `scan_environment` with `scope: "full"`.

Format the result as a compact markdown table:

```
| ID | Check | Status | Detail |
|----|-------|--------|--------|
```

Status indicators:
- `✓` for ok
- `⚠` for warn
- `✗` for error
- `○` for missing

End with one line: `Curato — X ok, Y warn, Z error, W missing.`

No repairs. No follow-up questions.

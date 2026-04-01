---
description: Run a full Curato environment scan and return a structured ScanReport. Use this skill when you need to assess the current state of a developer's Claude Code setup before taking any action.
allowed-tools: ["mcp__curato__scan_environment", "mcp__curato__check_node_runtime", "mcp__curato__check_plugin_state", "mcp__curato__check_mcp_registration"]
---

## scan-environment skill

Run all four scan tools in parallel:

1. `scan_environment scope="full"` — comprehensive environment scan
2. `check_node_runtime` — Node.js version and PATH details
3. `check_plugin_state` — installed plugin health
4. `check_mcp_registration` — MCP server registration and binary reachability

Return a consolidated result with:
- The full `ScanReport` from `scan_environment`
- Summary counts: ok / warn / error / missing
- List of fixable issues (severity error or missing, fixable:true)

Do not apply any fixes. Do not ask questions.

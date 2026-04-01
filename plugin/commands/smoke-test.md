---
description: Run the Curato 7-step validation suite to verify the environment is operational.
argument-hint: "[fixture-dir]"
allowed-tools: ["mcp__curato__run_smoke_test", "mcp__curato__create_smoke_test_app"]
---

You are running the Curato smoke test. Curato is validating the environment.

## Step 0: Pre-flight Check

Check whether the `run_smoke_test` MCP tool is available.

If it is NOT available:
1. Output:
   ```
   Curato: MCP server not connected.

   Cannot run the smoke test — the curato MCP server is not running.
   Run the bash fallback instead:
     bash scripts/smoke-test.sh

   To fix the MCP connection:
     1. Install Node.js v18+: https://nodejs.org
     2. cd mcp-server && npm run build
     3. bash scripts/install.sh
     4. Reload your Claude Code window
   ```
2. STOP.

## Step 1: Announce

Output: `Running smoke test...`

## Step 2: Run

Call `run_smoke_test` with `fixtureDir` set to $ARGUMENTS if provided, otherwise use the default.

## Step 3: Format Results

Present each step as a pass/fail line:

```
  [PASS] node-reachable        v24.13.1
  [PASS] mcp-server-starts     312ms
  [PASS] tool-list             11 tools registered
  [PASS] scan-runs             ScanReport: 3 ok, 2 warn, 0 error
  [PASS] plugin-readable       plugin.json valid
  [PASS] doctor-command-exists doctor.md found
  [PASS] repair-dry-run        2 proposals, 0 applied
```

For failed steps, show the error detail.

## Step 4: Summary

`N/7 passed.`

If all pass: `Curato is operational.`
If any fail: `Anomalies detected. Run /doctor for full diagnosis and repairs.`

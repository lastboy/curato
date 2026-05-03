---
description: Run the Curato 7-step validation suite to verify the environment is operational.
argument-hint: "[fixture-dir]"
allowed-tools: ["Bash"]
---

## Step 1: Announce

Output: `Running smoke test...`

## Step 2: Run

Run: `curato scan 2>&1`

## Step 3: Format

Present each check as a pass/fail line:
```
  [PASS] node-runtime        v24.x
  [PASS] claude-settings     ~/.claude/settings.json
  ...
```

## Step 4: Summary

Count passes and failures. Output: `N/N passed.`

If all pass: `Curato is operational.`
If any fail: `Anomalies detected. Run /doctor for full diagnosis and repairs.`

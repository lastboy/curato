---
description: Run the Curato smoke test and format results. Use this skill at the end of a /doctor or /repair flow to confirm the environment is operational.
allowed-tools: ["mcp__curato__run_smoke_test"]
---

## smoke-test skill

**Step 1:** Call `run_smoke_test`.

**Step 2:** Format each step as a pass/fail line:
```
  [PASS] <step-name>   <output>
  [FAIL] <step-name>   <error>
```

**Step 3:** Output summary: `N/7 passed.`

**Step 4:**
- All pass → `Curato is operational.`
- Any fail → `Anomalies detected. Run /doctor for full diagnosis.`

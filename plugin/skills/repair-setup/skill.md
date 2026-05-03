---
description: Run a dry-run scan, confirm with the user, then apply repairs via curato CLI. Use this skill from /repair or repair-agent.
allowed-tools: ["Bash", "AskUserQuestion"]
---

## repair-setup skill

**Step 1:** Run `npx -y curato scan 2>&1` to get current state.

**Step 2:** If all checks pass — stop. Reply: "No fixable issues found."

**Step 3:** Based on the scan output, determine the appropriate `npx curato` commands to fix each issue. Show a numbered list.

**Step 4:** Ask the user: "Apply these N repair(s)? (yes/no)"

**Step 5 (if yes):** Run each repair command via Bash.

**Step 6:** Run `npx -y curato scan 2>&1` again and report final state.

**Safety rules:**
- Never apply repairs without explicit user confirmation
- Never modify files outside what curato CLI would touch

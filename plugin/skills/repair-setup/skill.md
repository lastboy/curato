---
description: Run a dry-run repair proposal, confirm with the user, then apply repairs. Always backs up files before writing. Use this skill from /repair or repair-agent.
allowed-tools: ["mcp__curato__recommend_setup", "mcp__curato__repair_setup", "mcp__curato__apply_setup", "AskUserQuestion"]
---

## repair-setup skill

**Step 1:** Call `recommend_setup` to get `RepairProposal[]`.

**Step 2:** If proposals is empty — stop. Reply: "No fixable issues found."

**Step 3:** Show a numbered list of proposals with `targetPath` and `action`.

**Step 4:** Ask the user: "Apply these N repair(s)? (yes/no)"

**Step 5 (if yes):** Call `repair_setup` with:
- `dryRun: false`
- `checkIds`: the IDs from the proposals

**Step 6:** Report results. If `backupDir` is set in the response, always mention it.

**Safety rules:**
- Never call repair_setup with dryRun:false without explicit user confirmation
- Never modify files outside the proposed repair paths
- Always mention the backupDir so the user knows they can roll back

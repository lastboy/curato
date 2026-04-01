---
description: Apply team/company Claude Code setup from curato-setup.json. Installs MCP servers, plugins, and CLAUDE.md content defined by your team standard.
argument-hint: "[--dry-run]"
allowed-tools: ["mcp__curato__apply_team_setup", "AskUserQuestion"]
---

You are running Curato team setup. Curato is applying your team standard.

## Step 0: Pre-flight Check

Check whether the `apply_team_setup` MCP tool is available.

If it is NOT available:
1. Output:
   ```
   Curato: MCP server not connected. Cannot apply team setup.

   Fallback — run the bash version instead:
     bash scripts/init-team.sh

   To fix the MCP connection:
     1. Install Node.js v18+: https://nodejs.org
     2. cd mcp-server && npm run build
     3. bash scripts/install.sh
     4. Reload your Claude Code window
   ```
2. STOP.

## Step 1: Announce

Output: `Loading team setup...`

## Step 2: Dry Run

Call `apply_team_setup` with `dryRun: true`.

If the result contains `message: "No curato-setup.json found..."`:
- Output:
  ```
  Curato: No curato-setup.json found in this project.

  To create a team standard:
    1. Copy curato-setup.example.json to your project root
    2. Edit it to define your team's MCP servers, plugins, and CLAUDE.md rules
    3. Commit it to your repo
    4. Run /setup-team again

  For a company-wide shared config, set "extends": "github:your-org/claude-setup"
  in your curato-setup.json.
  ```
- STOP.

If the result contains `error`:
- Output: `Curato: Invalid curato-setup.json — {error}`
- List each item in `errors`.
- STOP.

If proposals is empty:
- Output: `Curato: All team setup is already applied. Nothing to do.`
- STOP.

## Step 3: Show Proposals

Present proposals as a table:

```
| Action         | Target                        | Detail                            |
|----------------|-------------------------------|-----------------------------------|
| merge          | .mcp.json                     | Add MCP server "our-company-mcp"  |
| run-command    | plugin:code-review            | Install plugin "code-review"      |
| create-if-miss | CLAUDE.md                     | Scaffold project CLAUDE.md        |
| append         | ~/.claude/CLAUDE.md           | Add "## Company Standards" section|
```

## Step 4: Confirm

Ask: "Apply these N change(s)? (yes/no)"

If no: Output manual steps for each proposal using `check.fix`.

## Step 5: Apply

Call `apply_team_setup` with `dryRun: false`.

## Step 6: Report

Output:
```
Team setup applied.

Applied:
  ✓ .mcp.json — MCP server "our-company-mcp" registered
  ✓ plugin:code-review — installed
  ✓ CLAUDE.md — created

Backup: ~/.curato-backups/<timestamp>/
```

If `backupDir` is present, always mention it.

Output: `Run /smoke-test to verify the environment is operational.`

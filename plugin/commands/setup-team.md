---
description: Apply team/company Claude Code setup from curato-setup.json. Installs MCP servers, plugins, and CLAUDE.md content defined by your team standard.
argument-hint: "[--dry-run]"
allowed-tools: ["Bash", "AskUserQuestion"]
---

You are running Curato team setup.

## Step 1: Announce

Output: `Loading team setup...`

## Step 2: Dry Run

Run: `curato setup --dry-run 2>&1`

If the output contains "No curato-setup.json found":
- Output:
  ```
  Curato: No curato-setup.json found in this project.

  To create a team standard:
    1. Create curato-setup.json in your project root
    2. Edit it to define your team's MCP servers, plugins, and CLAUDE.md rules
    3. Commit it to your repo
    4. Run /setup-team again
  ```
- STOP.

If output contains "Invalid curato-setup.json":
- Show the error and STOP.

If output says "Everything already up to date":
- Output: `Curato: All team setup is already applied. Nothing to do.`
- STOP.

## Step 3: Show Preview

Show the dry-run output to the user.

## Step 4: Confirm

Ask: "Apply these changes? (yes/no)"

If no: STOP.

## Step 5: Apply

Run: `curato setup $ARGUMENTS 2>&1`

## Step 6: Report

Show the output.

Output: `Run /smoke-test to verify the environment is operational.`

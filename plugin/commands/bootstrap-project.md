---
description: Scaffold a Claude Code project setup — creates .claude/, CLAUDE.md, and settings.local.json if missing.
argument-hint: "[target-directory]"
allowed-tools: ["Bash", "AskUserQuestion"]
---

## Step 1: Determine target

Use $ARGUMENTS as the target directory if provided, otherwise use the current directory.

## Step 2: Check what exists

Run: `ls -la <target>/.claude/ 2>&1 && ls <target>/CLAUDE.md 2>&1 && ls <target>/.mcp.json 2>&1`

## Step 3: Report and confirm

Show what exists and what is missing. If everything is already present:
Output: `Curato: project already has a complete Claude Code setup.` and STOP.

List what will be created. Ask: "Bootstrap these files? (yes/no)"

If no: STOP.

## Step 4: Apply

Run the appropriate commands:
- `mkdir -p <target>/.claude/commands <target>/.claude/agents`
- Create `<target>/CLAUDE.md` with a template if missing
- Create `<target>/.claude/settings.local.json` with `{}` if missing

## Step 5: Done

Output what was created. Suggest:
"Edit CLAUDE.md to add your project's architecture, stack, and conventions."

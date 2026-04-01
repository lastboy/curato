---
description: Scaffold a Claude Code project setup — creates .claude/, CLAUDE.md, and settings.local.json if missing.
argument-hint: "[target-directory]"
allowed-tools: ["mcp__curato__inspect_project_setup", "mcp__curato__apply_setup", "AskUserQuestion"]
---

You are running Curato project bootstrap. Curato is scaffolding.

## Step 0: Scope Guidance

Before doing anything, output this table so the user understands where things belong:

```
Scope reference:

| What                         | Scope   | Location                        |
|------------------------------|---------|---------------------------------|
| Local project MCP server     | project | .mcp.json                       |
| Globally installed MCP tool  | user    | ~/.claude.json (claude mcp add) |
| Plugins                      | user    | claude plugin install           |
| Project AI instructions      | project | ./CLAUDE.md                     |
| Company-wide AI rules        | user    | ~/.claude/CLAUDE.md             |
| Team standard setup          | both    | curato-setup.json + /setup-team|
```

## Step 1: Inspect

Call `inspect_project_setup` with `cwd` set to $ARGUMENTS (if provided) or the current working directory.

## Step 2: Report Current State

Show what exists and what is missing:
- `.claude/` directory
- `CLAUDE.md`
- `.mcp.json`

## Step 3: Confirm Scaffold

If everything already exists, output: `Curato: project already has a complete Claude Code setup.` and stop.

Otherwise, list what will be created and ask: "Bootstrap these files? (yes/no)"

## Step 4: Apply

Call `apply_setup` with:
- `dryRun: false`
- `cwd`: the target directory
- `targets`: only the missing check IDs (`project.claude-dir`, `project.claude-md`)

## Step 5: Done

Output what was created and suggest:
"Edit CLAUDE.md to add your project's architecture, stack, and conventions."

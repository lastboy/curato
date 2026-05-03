---
description: Clear Claude Code plugin cache — for one plugin, one marketplace, or everything.
argument-hint: "[--plugin <name>] [--marketplace <name>]"
allowed-tools: ["Bash", "AskUserQuestion"]
---

## Step 1: Dry run

Run: `npx -y curato clear-cache $ARGUMENTS --dry-run 2>&1`

If output says "Nothing matched": output `Curato: Nothing to clear. Cache is already empty.` and STOP.

Show the list of directories that will be deleted.

## Step 2: Confirm

Ask: "Clear these directories? (yes/no)"

If no: output `Curato: Aborted.` and STOP.

## Step 3: Apply

Run: `npx -y curato clear-cache $ARGUMENTS 2>&1`

## Step 4: Report

Show the output. Then:
`Run /smoke-test to verify the environment is still operational.`

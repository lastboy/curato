---
description: Connect the azure-devops MCP server — removes stale registrations, registers the correct binary in both CLI and VS Code registries with envvar PAT auth, then instructs user to reload.
allowed-tools: ["Bash", "AskUserQuestion"]
---

You are connecting the Azure DevOps MCP server.

The correct binary is `mcp-server-azuredevops` (`@azure-devops/mcp`, Microsoft's package).
The wrong binary is `azure-devops-mcp-server` (community package — different env vars, does not work).

## Step 1: Remove any stale registration

Run: `npx -y curato remove-mcp azure-devops 2>&1`

(This is safe even if not registered — it will say "not found".)

## Step 2: Resolve binary path and org name

Run: `which mcp-server-azuredevops 2>&1` to get the absolute binary path.

Ask the user for their Azure DevOps org name (e.g. `MyOrg`) if not already known.

The PAT must already be set as `ADO_MCP_AUTH_TOKEN` in the shell. Do NOT ask for it or hardcode it.

## Step 3: Register

Run:
```
npx -y curato register-mcp azure-devops <binary-path> \
  --args "<ORG>,- d,repositories,work-items,wiki,--authentication,envvar" \
  --env "PATH=<node-bin-dir>:/usr/local/bin:/usr/bin:/bin" \
  2>&1
```

## Step 4: Done

Output:
```
Curato: azure-devops registered with envvar auth.

Next steps:
  1. Reload this window:  Cmd+Shift+P → Developer: Reload Window
  2. After reload, ask Claude to list your Azure DevOps repositories or work items.
```

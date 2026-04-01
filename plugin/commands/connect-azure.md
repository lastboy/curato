---
description: Connect the azure-devops MCP server — removes stale registrations, registers the correct binary in both CLI and VS Code registries with envvar PAT auth, then instructs user to reload.
allowed-tools: ["mcp__curato__check_mcp_registration", "mcp__curato__remove_mcp_server", "mcp__curato__register_mcp_both"]
---

You are connecting the Azure DevOps MCP server. 

The correct binary is `mcp-server-azuredevops` (`@azure-devops/mcp`, Microsoft's package).
The wrong binary is `azure-devops-mcp-server` (community package — different env vars, does not work).

## Step 1: Check current state

Call `check_mcp_registration` with `serverName: "azure-devops"`.

Inspect all returned entries. An entry is **correct** if:
- `command` ends with `mcp-server-azuredevops`
- `args` includes `"--authentication"` and `"envvar"`

An entry is **stale/wrong** if:
- `command` ends with `azure-devops-mcp-server` (wrong binary), OR
- `command` ends with `mcp-server-azuredevops` but is missing `--authentication envvar` args

If ALL entries are correct AND both `source: "vscode"` and `source: "cli"` are present → output:
`Curato: azure-devops already correctly registered in both registries.` and STOP.

Otherwise proceed to Step 2.

## Step 2: Remove stale registrations

If any stale/wrong entry exists, call `remove_mcp_server` with `serverName: "azure-devops"` to clear both registries.

## Step 3: Resolve the binary path and org name

Before registering, resolve:
1. Run `which mcp-server-azuredevops` in a bash tool call to get the absolute binary path.
2. Ask the user for their Azure DevOps org name (e.g. `MyOrg`) if not already known from context.

The PAT must already be exported in the shell as `ADO_MCP_AUTH_TOKEN`. Do NOT ask for it or hardcode it — it is read from the environment at runtime.

## Step 4: Register in both registries (envvar auth)

Call `register_mcp_both` with:
- `serverName`: `"azure-devops"`
- `command`: _(absolute path from `which mcp-server-azuredevops`)_
- `args`: `["<ORG_NAME>", "-d", "repositories", "work-items", "wiki", "--authentication", "envvar"]`
- `env`: `{ "PATH": "<node_bin_dir>:/usr/local/bin:/usr/bin:/bin" }` _(do NOT include the token)_
- `dryRun`: `false`

## Step 5: Done

Output:
```
Curato: azure-devops registered with envvar auth.

Next steps:
  1. Reload this window:  Cmd+Shift+P → Developer: Reload Window
  2. After reload, ask Claude to list your Azure DevOps repositories or work items.
```

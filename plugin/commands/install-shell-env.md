---
description: Install a macOS LaunchAgent that forwards shell env vars (like ADO_MCP_AUTH_TOKEN) into launchd, so GUI-launched apps (VS Code from Dock) see them. No token values stored on disk.
argument-hint: "[--var NAME] [--config] [--dry-run]"
allowed-tools: ["Bash"]
---

Run: `npx -y curato install-shell-env $ARGUMENTS 2>&1`

Show the output as-is. If no `--var` and no `--config` are passed, the command errors — suggest the user pass `--var ADO_MCP_AUTH_TOKEN` or `--config` to read from `curato-setup.json`.

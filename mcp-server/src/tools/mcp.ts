import { register } from './index.js';
import { toolResult } from '../types.js';
import type { CheckMcpRegistrationParams, RemoveMcpServerParams, RegisterMcpBothParams } from '../types.js';
import { scanMcpRegistry } from '../scanner/mcp-registry.js';
import { backupFile } from '../patcher/backup.js';
import { registerMcpServer } from '../patcher/mcp-registrar.js';
import { removeMcpServer } from '../patcher/mcp-remover.js';
import { safeMerge } from '../patcher/json-merger.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { isWin } from '../utils/platform.js';

register(
  {
    name: 'register_mcp_both',
    description:
      'Register an MCP server in both Claude Code registries: ~/.claude/settings.json (VS Code) and ~/.claude.json (CLI). Uses safeMerge — existing entries are never overwritten. Creates a backup before any write. Use dryRun:true to preview without modifying files.',
    inputSchema: {
      type: 'object',
      required: ['serverName', 'command', 'dryRun'],
      properties: {
        serverName: { type: 'string', description: 'Name of the MCP server' },
        command: { type: 'string', description: 'Executable path or binary name' },
        args: { type: 'array', items: { type: 'string' }, description: 'CLI arguments' },
        env: { type: 'object', additionalProperties: { type: 'string' }, description: 'Environment variables' },
        dryRun: { type: 'boolean', description: 'If true, return proposed changes without writing' },
      },
    },
  },
  async (args) => {
    const { serverName, command, args: cmdArgs, env, dryRun } = args as RegisterMcpBothParams;
    const entry = { command, ...(cmdArgs ? { args: cmdArgs } : {}), ...(env ? { env } : {}) };

    // --- VS Code registry: ~/.claude/settings.json ---
    const vsResult = registerMcpServer({ serverName, entry, dryRun });

    // --- CLI registry: ~/.claude.json ---
    const claudeJsonPath = join(homedir(), '.claude.json');
    let claudeJson: Record<string, unknown> = {};
    if (existsSync(claudeJsonPath)) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(claudeJsonPath, 'utf8'));
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          claudeJson = parsed as Record<string, unknown>;
        }
      } catch { claudeJson = {}; }
    }
    const existingCliMcp =
      claudeJson['mcpServers'] && typeof claudeJson['mcpServers'] === 'object' && !Array.isArray(claudeJson['mcpServers'])
        ? (claudeJson['mcpServers'] as Record<string, unknown>)
        : {};
    const cliAlreadyPresent = serverName in existingCliMcp;
    const newCliMcp = safeMerge(existingCliMcp, { [serverName]: entry });

    let cliBackupDir: string | undefined;
    if (!dryRun && !cliAlreadyPresent) {
      cliBackupDir = backupFile(claudeJsonPath);
      const updated = safeMerge(claudeJson, { mcpServers: newCliMcp });
      writeFileSync(claudeJsonPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    }

    return toolResult({
      dryRun,
      serverName,
      vscode: {
        path: vsResult.settingsPath,
        alreadyPresent: vsResult.alreadyPresent,
        backupDir: vsResult.backupDir,
      },
      cli: {
        path: claudeJsonPath,
        alreadyPresent: cliAlreadyPresent,
        backupDir: cliBackupDir,
      },
    });
  },
);

register(
  {
    name: 'launch_azure_auth',
    description:
      'Kill any stale azure-devops MCP process so Claude Code spawns a fresh one on next use. The fresh process (registered with interactive auth, no --authentication envvar) will open a browser for MSAL login on the first tool call. Use this to force re-authentication.',
    inputSchema: { type: 'object', properties: {} },
  },
  async () => {
    // Kill any stale process so Claude Code spawns a fresh one after reload
    let killed = false;
    try {
      if (isWin()) {
        // TODO: verify exact process name on Windows before relying on this
        const r = spawnSync('taskkill', ['/F', '/IM', 'mcp-server-azuredevops.exe'], { stdio: 'ignore' });
        killed = r.status === 0;
      } else {
        execSync('pkill -f "azure-devops-mcp-server"', { stdio: 'ignore' });
        killed = true;
      }
    } catch { /* none running */ }

    const nodeBin = dirname(process.execPath);
    const binary = join(nodeBin, 'azure-devops-mcp-server');

    return toolResult({
      launched: true,
      killed,
      binary,
      nodeBin,
      note: 'Stale process cleared. Reload the Claude Code window — the browser will open for Azure DevOps login on the first tool call.',
    });
  },
);

register(
  {
    name: 'remove_mcp_server',
    description:
      'Remove a named MCP server from all Claude Code registries: ~/.claude/settings.json, ~/.claude/settings.local.json (VS Code), ~/.claude.json (CLI), and .mcp.json in cwd. Creates a backup before any write. Use dryRun:true to preview without modifying files.',
    inputSchema: {
      type: 'object',
      required: ['serverName', 'dryRun'],
      properties: {
        serverName: {
          type: 'string',
          description: 'Name of the MCP server to remove',
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, return what would be removed without writing anything',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for project-scope .mcp.json lookup (defaults to process.cwd())',
        },
      },
    },
  },
  async (args) => {
    const { serverName, dryRun, cwd } = (args as RemoveMcpServerParams & { cwd?: string });
    return toolResult(removeMcpServer({ serverName, dryRun, cwd }));
  },
);

register(
  {
    name: 'check_mcp_registration',
    description:
      'Validate MCP server registrations in .mcp.json and ~/.claude/settings.json. Checks binary reachability and flags duplicates. Returns McpServerEntry[].',
    inputSchema: {
      type: 'object',
      properties: {
        serverName: {
          type: 'string',
          description: 'Specific server name to check (omit to check all)',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for project-scope .mcp.json lookup',
        },
      },
    },
  },
  async (args) => {
    const { serverName, cwd = process.cwd() } = (args as CheckMcpRegistrationParams) ?? {};
    return toolResult(scanMcpRegistry(cwd, serverName));
  },
);

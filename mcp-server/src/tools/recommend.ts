import { register } from './index.js';
import { toolResult } from '../types.js';
import type { RepairProposal, RecommendSetupParams } from '../types.js';
import { buildNodeChecks, buildUserChecks, buildProjectChecks, buildPluginChecks, buildMcpChecks } from './scan.js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { scanNodeRuntime } from '../scanner/node-runtime.js';
import { scanMcpRegistry } from '../scanner/mcp-registry.js';
import { readSettingsJson } from '../scanner/claude-config.js';
import { pathSep, isWin } from '../utils/platform.js';

const CLAUDE_MD_TEMPLATE = `# Project

## Overview
<!-- Describe what this project is -->

## Architecture
<!-- Key architectural decisions and structure -->

## Commands
<!-- Custom slash commands available in this project -->

## Stack
<!-- Tech stack and key dependencies -->

## Conventions
<!-- Code style, patterns, and conventions to follow -->
`;

const SETTINGS_JSON_TEMPLATE = JSON.stringify(
  { permissions: { allow: [] } },
  null,
  2,
);

export function buildRepairProposals(
  cwd: string,
  targetIds?: string[],
): RepairProposal[] {
  const allChecks = [
    ...buildNodeChecks(),
    ...buildUserChecks(),
    ...buildProjectChecks(cwd),
    ...buildPluginChecks(),
    ...buildMcpChecks(cwd),
  ];

  const fixable = allChecks.filter(
    (c) =>
      c.fixable &&
      (targetIds ? targetIds.includes(c.id) : c.severity === 'error' || c.severity === 'missing'),
  );

  const proposals: RepairProposal[] = [];

  for (const check of fixable) {
    if (check.id === 'user.settings') {
      const targetPath = join(homedir(), '.claude', 'settings.json');
      proposals.push({
        check,
        action: 'create-if-missing',
        targetPath,
        after: SETTINGS_JSON_TEMPLATE,
      });
    } else if (check.id === 'user.claude-md') {
      const targetPath = join(homedir(), '.claude', 'CLAUDE.md');
      proposals.push({
        check,
        action: 'create-if-missing',
        targetPath,
        after: CLAUDE_MD_TEMPLATE,
      });
    } else if (check.id === 'project.claude-dir') {
      // scaffold .claude/ dir — represented as create-if-missing of settings.local.json
      const targetPath = join(cwd, '.claude', 'settings.local.json');
      proposals.push({
        check,
        action: 'create-if-missing',
        targetPath,
        after: JSON.stringify({}, null, 2),
      });
    } else if (check.id === 'project.claude-md') {
      const targetPath = join(cwd, 'CLAUDE.md');
      let before: string | undefined;
      if (existsSync(targetPath)) {
        try { before = readFileSync(targetPath, 'utf8'); } catch { /* leave undefined */ }
      }
      proposals.push({
        check,
        action: 'create-if-missing',
        targetPath,
        before,
        after: CLAUDE_MD_TEMPLATE,
      });
    } else if (check.id.startsWith('mcp.gap-vscode.')) {
      // Server in CLI but missing from VS Code settings.json — merge it in
      const serverName = check.id.slice('mcp.gap-vscode.'.length);
      const entry = scanMcpRegistry(cwd).find((e) => e.name === serverName && e.source === 'cli');
      if (entry) {
        const targetPath = join(homedir(), '.claude', 'settings.json');
        const settings = readSettingsJson();
        const mcpServers = (settings['mcpServers'] as Record<string, unknown> | undefined) ?? {};
        const newEntry: Record<string, unknown> = { command: entry.command };
        if (entry.args?.length) newEntry['args'] = entry.args;
        if (entry.env && Object.keys(entry.env).length) newEntry['env'] = entry.env;
        const after = JSON.stringify({ ...settings, mcpServers: { ...mcpServers, [serverName]: newEntry } }, null, 2);
        proposals.push({ check, action: 'overwrite', targetPath, after });
      }
    } else if (check.id.startsWith('mcp.gap-cli.')) {
      // Server in VS Code settings.json but missing from CLI — register via claude mcp add
      const serverName = check.id.slice('mcp.gap-cli.'.length);
      const entry = scanMcpRegistry(cwd).find((e) => e.name === serverName && e.source === 'vscode');
      if (entry?.command) {
        const args = ['mcp', 'add', '-s', 'user', serverName, '--', entry.command, ...(entry.args ?? [])];
        proposals.push({
          check,
          action: 'run-command',
          targetPath: join(homedir(), '.claude.json'),
          command: ['claude', ...args],
          after: `claude ${args.join(' ')}`,
        });
      }
    } else if (check.id === 'node.path') {
      const { nodePath } = scanNodeRuntime();
      // nodePath is e.g. /Users/arik/.nvm/versions/node/v24.13.1/bin/node
      const nvmBin = nodePath !== 'unknown' ? nodePath.replace(/\/node$/, '') : '';
      if (nvmBin) {
        const targetPath = join(homedir(), '.claude', 'settings.json');
        const settings = readSettingsJson();
        const existingEnv = (settings['env'] as Record<string, string> | undefined) ?? {};
        const existingPath = existingEnv['PATH'] ?? '';
        const sep = pathSep();
        const defaultFallback = isWin() ? 'C:\\Windows\\System32' : '/usr/local/bin:/usr/bin:/bin';
        const newPath = existingPath ? `${nvmBin}${sep}${existingPath}` : `${nvmBin}${sep}${defaultFallback}`;
        const after = JSON.stringify({ ...settings, env: { ...existingEnv, PATH: newPath } }, null, 2);
        proposals.push({ check, action: 'overwrite', targetPath, after });
      }
    } else if (check.id.startsWith('mcp.nvm-unsafe.')) {
      // Bare command — replace with absolute path in VS Code settings.json
      const serverName = check.id.slice('mcp.nvm-unsafe.'.length);
      const entry = scanMcpRegistry(cwd).find((e) => e.name === serverName);
      if (entry?.binaryPath) {
        const targetPath = join(homedir(), '.claude', 'settings.json');
        const settings = readSettingsJson();
        const mcpServers = (settings['mcpServers'] as Record<string, unknown> | undefined) ?? {};
        if (mcpServers[serverName] && typeof mcpServers[serverName] === 'object') {
          const updated = { ...(mcpServers[serverName] as Record<string, unknown>), command: entry.binaryPath };
          const after = JSON.stringify({ ...settings, mcpServers: { ...mcpServers, [serverName]: updated } }, null, 2);
          proposals.push({ check, action: 'overwrite', targetPath, after });
        }
      }
    }
  }

  return proposals;
}

register(
  {
    name: 'recommend_setup',
    description:
      'Produce structured repair proposals without applying them. Returns RepairProposal[] describing what would be changed.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: 'Working directory (defaults to process.cwd())',
        },
        goals: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific goals e.g. ["register-mcp", "create-claude-md"]',
        },
      },
    },
  },
  async (args) => {
    const { cwd = process.cwd() } = (args as RecommendSetupParams) ?? {};
    const proposals = buildRepairProposals(cwd);
    return toolResult(proposals);
  },
);

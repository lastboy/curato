import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import type { McpServerEntry } from '../types.js';
import { getClaudeDir, readSettingsJson, readClaudeJson } from './claude-config.js';
import { whichCmd } from '../utils/platform.js';

interface RawMcpEntry {
  command?: unknown;
  args?: unknown;
  type?: unknown;
  url?: unknown;
  env?: unknown;
}

function resolveBinary(command: string | undefined): { resolvable: boolean; path?: string } {
  if (!command) return { resolvable: false };
  // Absolute path — check existence directly
  if (command.startsWith('/') || /^[A-Za-z]:\\/.test(command)) {
    return { resolvable: existsSync(command), path: command };
  }
  const result = spawnSync(whichCmd(), [command], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout) {
    // 'where' on Windows may return multiple lines — take the first
    const resolved = result.stdout.trim().split('\n')[0]?.trim() ?? '';
    return { resolvable: !!resolved, path: resolved || undefined };
  }
  return { resolvable: false };
}

function parseEntries(
  raw: Record<string, unknown>,
  registeredIn: 'project' | 'global',
  source: 'vscode' | 'cli' | 'project',
): McpServerEntry[] {
  const entries: McpServerEntry[] = [];
  for (const [name, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    const entry = value as RawMcpEntry;
    const command = typeof entry.command === 'string' ? entry.command : undefined;
    const { resolvable, path } = resolveBinary(command);

    entries.push({
      name,
      command,
      args: Array.isArray(entry.args)
        ? (entry.args as unknown[]).map(String)
        : undefined,
      type: entry.type === 'http' ? 'http' : 'stdio',
      url: typeof entry.url === 'string' ? entry.url : undefined,
      env:
        entry.env && typeof entry.env === 'object'
          ? (entry.env as Record<string, string>)
          : undefined,
      registeredIn,
      source,
      binaryResolvable: resolvable,
      binaryPath: path,
    });
  }
  return entries;
}

function readMcpJson(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

export function scanMcpRegistry(cwd: string = process.cwd(), serverName?: string): McpServerEntry[] {
  const projectEntries = parseEntries(readMcpJson(join(cwd, '.mcp.json')), 'project', 'project');

  // VS Code registry: ~/.claude/settings.json
  const globalSettings = readSettingsJson();
  const globalMcp =
    globalSettings['mcpServers'] &&
    typeof globalSettings['mcpServers'] === 'object' &&
    !Array.isArray(globalSettings['mcpServers'])
      ? (globalSettings['mcpServers'] as Record<string, unknown>)
      : {};
  const globalEntries = parseEntries(globalMcp, 'global', 'vscode');

  // VS Code registry: ~/.claude/settings.local.json
  const claudeDir = getClaudeDir();
  const localSettings = readMcpJson(join(claudeDir, 'settings.local.json'));
  const localMcp =
    localSettings['mcpServers'] &&
    typeof localSettings['mcpServers'] === 'object'
      ? (localSettings['mcpServers'] as Record<string, unknown>)
      : {};
  const localEntries = parseEntries(localMcp, 'global', 'vscode');

  // CLI registry: ~/.claude.json (written by `claude mcp add -s user`)
  const claudeJson = readClaudeJson();
  const claudeJsonMcp =
    claudeJson['mcpServers'] &&
    typeof claudeJson['mcpServers'] === 'object' &&
    !Array.isArray(claudeJson['mcpServers'])
      ? (claudeJson['mcpServers'] as Record<string, unknown>)
      : {};
  const claudeJsonEntries = parseEntries(claudeJsonMcp, 'global', 'cli');

  // CLI registry: project-scoped entry in ~/.claude.json
  const projects = claudeJson['projects'];
  const projectMcp =
    projects &&
    typeof projects === 'object' &&
    !Array.isArray(projects) &&
    (projects as Record<string, unknown>)[cwd] &&
    typeof (projects as Record<string, unknown>)[cwd] === 'object'
      ? (
          (projects as Record<string, Record<string, unknown>>)[cwd]['mcpServers'] as
            | Record<string, unknown>
            | undefined
        ) ?? {}
      : {};
  const claudeJsonProjectEntries = parseEntries(projectMcp, 'project', 'cli');

  const all = [
    ...projectEntries,
    ...globalEntries,
    ...localEntries,
    ...claudeJsonEntries,
    ...claudeJsonProjectEntries,
  ];

  // Flag duplicate names across scopes
  const seen = new Map<string, number>();
  for (const e of all) {
    seen.set(e.name, (seen.get(e.name) ?? 0) + 1);
  }

  const deduped = all.filter((e, idx, arr) => {
    const firstIdx = arr.findIndex((x) => x.name === e.name && x.registeredIn === e.registeredIn);
    return firstIdx === idx;
  });

  if (serverName) {
    return deduped.filter((e) => e.name === serverName);
  }
  return deduped;
}

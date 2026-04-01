import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { safeMerge } from './json-merger.js';
import { backupFile } from './backup.js';

export interface McpRegistrationEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface RegisterMcpResult {
  dryRun: boolean;
  settingsPath: string;
  serverName: string;
  alreadyPresent: boolean;
  backupDir?: string;
  proposed: string; // JSON string of what the mcpServers section will look like
}

/**
 * Add or verify an MCP server entry in ~/.claude/settings.json.
 * Uses safeMerge — existing entries are never modified.
 */
export function registerMcpServer(opts: {
  serverName: string;
  entry: McpRegistrationEntry;
  dryRun: boolean;
  settingsPath?: string;
}): RegisterMcpResult {
  const settingsPath =
    opts.settingsPath ?? join(homedir(), '.claude', 'settings.json');

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    } catch {
      settings = {};
    }
  }

  const existingMcp =
    settings['mcpServers'] && typeof settings['mcpServers'] === 'object'
      ? (settings['mcpServers'] as Record<string, unknown>)
      : {};

  const alreadyPresent = opts.serverName in existingMcp;

  const newMcp = safeMerge(existingMcp, {
    [opts.serverName]: opts.entry,
  });

  const proposed = JSON.stringify(newMcp, null, 2);

  if (!opts.dryRun && !alreadyPresent) {
    const backupDir = backupFile(settingsPath);
    const updated = safeMerge(settings, { mcpServers: newMcp });
    writeFileSync(settingsPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    return { dryRun: false, settingsPath, serverName: opts.serverName, alreadyPresent, backupDir, proposed };
  }

  return { dryRun: opts.dryRun, settingsPath, serverName: opts.serverName, alreadyPresent, proposed };
}

#!/usr/bin/env node
// uninstall.js — Cross-platform replacement for uninstall.sh
// Removes ONLY curato. Never touches other plugins, MCP servers, or user config.

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === 'win32';
const CLAUDE = isWin ? 'claude.cmd' : 'claude';
const claudeDir = isWin
  ? (existsSync(join(process.env['APPDATA'] ?? homedir(), 'Claude')) ? join(process.env['APPDATA'] ?? homedir(), 'Claude') : join(homedir(), '.claude'))
  : join(homedir(), '.claude');

function capture(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8', stdio: 'inherit' });
}

console.log('Removing Curato...\n');

// ── 1. Uninstall plugin ───────────────────────────────────────────────────────

console.log('  [1/4] Uninstalling plugin...');
const pluginList = capture(CLAUDE, ['plugin', 'list']);
if (pluginList.stdout?.includes('curato')) {
  run(CLAUDE, ['plugin', 'uninstall', 'curato']);
  console.log('  [OK]  Plugin uninstalled');
} else {
  console.log('  [skip] Plugin not installed');
}

// ── 2. Remove local marketplace ───────────────────────────────────────────────

console.log('\n  [2/4] Removing local marketplace...');
const marketplaceList = capture(CLAUDE, ['plugin', 'marketplace', 'list']);
if (marketplaceList.stdout?.includes('curato-local')) {
  run(CLAUDE, ['plugin', 'marketplace', 'remove', 'curato-local']);
  console.log('  [OK]  Marketplace removed');
} else {
  console.log('  [skip] Marketplace not registered');
}

// ── 3. Remove MCP server registration ────────────────────────────────────────

console.log('\n  [3/4] Removing MCP server registration...');

const mcpList = capture(CLAUDE, ['mcp', 'list']);
if (mcpList.stdout?.includes('curato')) {
  const r = spawnSync(CLAUDE, ['mcp', 'remove', 'curato', '-s', 'user'], { encoding: 'utf8', stdio: 'ignore' });
  if (r.status !== 0) spawnSync(CLAUDE, ['mcp', 'remove', 'curato'], { encoding: 'utf8', stdio: 'ignore' });
  console.log('  [OK]  Removed from claude CLI');
} else {
  console.log('  [skip] Not in claude CLI registry');
}

const settingsPath = join(claudeDir, 'settings.json');
if (existsSync(settingsPath)) {
  try {
    const s = JSON.parse(readFileSync(settingsPath, 'utf8'));
    const mcp = s.mcpServers || {};
    if ('curato' in mcp) {
      // Backup first
      const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
      const backupDir = join(homedir(), '.curato-backups', ts);
      mkdirSync(backupDir, { recursive: true });
      copyFileSync(settingsPath, join(backupDir, 'settings.json'));
      // Remove only the curato key
      delete mcp['curato'];
      s.mcpServers = mcp;
      writeFileSync(settingsPath, JSON.stringify(s, null, 2) + '\n', 'utf8');
      console.log(`  [OK]  Removed from settings.json (backup: ${backupDir})`);
    } else {
      console.log('  [skip] Not in settings.json');
    }
  } catch (e) {
    console.log(`  [warn] Could not parse settings.json: ${e.message}`);
  }
}

// ── 4. Remove old symlink (legacy install.sh artifact) ────────────────────────

console.log('\n  [4/4] Cleaning up old symlink...');
const oldSymlink = join(claudeDir, 'plugins', 'marketplaces', 'claude-plugins-official', 'plugins', 'curato');
if (existsSync(oldSymlink)) {
  unlinkSync(oldSymlink);
  console.log(`  [OK]  Removed ${oldSymlink}`);
} else {
  console.log('  [skip] No legacy symlink found');
}

// ── Done ─────────────────────────────────────────────────────────────────────

console.log('\nCurato: Curato removed. Your other plugins and MCP servers are untouched.');
console.log(`Run node scripts/install.js to reinstall.`);

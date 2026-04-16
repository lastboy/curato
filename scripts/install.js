#!/usr/bin/env node
// install.js — Cross-platform replacement for install.sh
// Works on macOS, Linux, and Windows (no bash required).

import { existsSync, cpSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { repairStaleMarketplaceEntry } from './lib/marketplace-repair.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURATO_DIR = join(__dirname, '..');
const NODE_BIN = process.execPath;
const isWin = process.platform === 'win32';
const CLAUDE = isWin ? 'claude.cmd' : 'claude';
const MCP_CONF = join(homedir(), '.claude', 'settings.json');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'inherit', ...opts });
  if (r.error) throw r.error;
  return r;
}

function runCapture(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

console.log('Installing Curato...\n');

// ── 1. Build MCP server ──────────────────────────────────────────────────────

console.log('  [1/3] Building MCP server...');
run('npm', ['install', '--silent'], { cwd: join(CURATO_DIR, 'mcp-server') });
run('npm', ['run', 'build', '--silent'], { cwd: join(CURATO_DIR, 'mcp-server') });
console.log(`  [OK]  MCP server built at ${join(CURATO_DIR, 'mcp-server', 'dist', 'index.js')}`);

// ── 2. Install plugin via local marketplace ──────────────────────────────────

console.log('\n  [2/3] Installing plugin...');

// When installed via npx, the marketplace/curato symlink is stripped by npm.
// Ensure the directory exists by copying plugin/ into marketplace/curato/.
const marketplacePluginDir = join(CURATO_DIR, 'marketplace', 'curato');
if (!existsSync(marketplacePluginDir)) {
  cpSync(join(CURATO_DIR, 'plugin'), marketplacePluginDir, { recursive: true });
}

// Repair stale marketplace entry — older curato versions stored `source` as a plain string.
// Newer Claude Code validates `source` as a typed object and rejects the old format with
// "curato-local.source.source: Invalid input". Clear it so the add command starts fresh.
const knownMarketplacesPath = join(homedir(), '.claude', 'plugins', 'known_marketplaces.json');
const repairResult = repairStaleMarketplaceEntry(knownMarketplacesPath);
if (repairResult.repaired) {
  console.log('  [fix]  Removed stale curato-local marketplace entry (old source format)');
}

const marketplaceList = runCapture(CLAUDE, ['plugin', 'marketplace', 'list']);
if (marketplaceList.stdout?.includes('curato-local')) {
  console.log('  [skip] Marketplace already registered');
} else {
  const addResult = runCapture(CLAUDE, ['plugin', 'marketplace', 'add', join(CURATO_DIR, 'marketplace')]);
  if (addResult.status !== 0) {
    console.error(`  [warn] Marketplace add exited with code ${addResult.status}`);
    if (addResult.stderr) process.stderr.write(addResult.stderr);
  } else {
    console.log('  [OK]  Marketplace registered');
  }
}

const pluginList = runCapture(CLAUDE, ['plugin', 'list']);
if (pluginList.stdout?.includes('curato')) {
  console.log('  [skip] Plugin already installed');
} else {
  const installResult = runCapture(CLAUDE, ['plugin', 'install', 'curato']);
  if (installResult.status !== 0) {
    console.error(`  [warn] Plugin install exited with code ${installResult.status}`);
    if (installResult.stderr) process.stderr.write(installResult.stderr);
  } else {
    console.log('  [OK]  Plugin installed');
  }
}

// Bust plugin cache so updated command/agent/skill files are picked up
const cacheDir = join(homedir(), '.claude', 'plugins', 'cache', 'curato-local', 'curato');
if (existsSync(cacheDir)) {
  const versions = readdirSync(cacheDir);
  const version = versions[0];
  if (version) {
    for (const subdir of ['commands', 'agents', 'skills']) {
      const src = join(CURATO_DIR, 'plugin', subdir);
      const dst = join(cacheDir, version, subdir);
      if (existsSync(src) && existsSync(dst)) {
        cpSync(src, dst, { recursive: true });
      }
    }
    console.log('  [OK]  Plugin cache refreshed');
  }
}

// ── 3. Register MCP server ───────────────────────────────────────────────────

console.log('\n  [3/3] Registering MCP server...');
const mcpServerPath = join(CURATO_DIR, 'mcp-server', 'dist', 'index.js');

// Register in CLI registry via `claude mcp add` (writes to ~/.claude.json)
const mcpListResult = runCapture(CLAUDE, ['mcp', 'list']);
if (mcpListResult.stdout?.includes('curato')) {
  console.log('  [skip] MCP already registered in claude CLI');
} else {
  run(CLAUDE, ['mcp', 'add', '-s', 'user', 'curato', NODE_BIN, mcpServerPath]);
  console.log('  [OK]  MCP registered in claude CLI (~/.claude.json)');
}

// Also register in settings.json for VS Code extension
run(NODE_BIN, [
  join(CURATO_DIR, 'scripts', 'register-mcp.js'),
  '--name', 'curato',
  '--command', NODE_BIN,
  '--args', mcpServerPath,
  '--config', MCP_CONF,
]);

// ── Done ─────────────────────────────────────────────────────────────────────

console.log('\nCurato: Installation complete.');
console.log('Reload your Claude Code window, then run /doctor to verify.');

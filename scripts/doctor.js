#!/usr/bin/env node
// doctor.js — Cross-platform replacement for doctor.sh
// Diagnose a broken Curato environment without Claude Code or MCP running.

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURATO_DIR = join(__dirname, '..');
const isWin = process.platform === 'win32';
const CLAUDE = isWin ? 'claude.cmd' : 'claude';

let pass = 0, warn = 0, fail = 0;
const ok   = (msg) => { console.log(`  [OK]   ${msg}`); pass++; };
const warnf = (msg) => { console.log(`  [WARN] ${msg}`); warn++; };
const failf = (msg) => { console.log(`  [FAIL] ${msg}`); fail++; };

function capture(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

console.log('=== Curato Doctor ===\n');

// ── Node.js ──────────────────────────────────────────────────────────────────

const nodeVer = capture('node', ['--version']).stdout?.trim() || '';
if (!nodeVer) {
  failf('Node.js not found in PATH');
} else {
  const major = parseInt(nodeVer.replace(/^v/, ''), 10);
  if (major >= 18) ok(`Node.js ${nodeVer} (>= 18 required)`);
  else failf(`Node.js ${nodeVer} — version 18+ required`);
}

// ── npm ──────────────────────────────────────────────────────────────────────

const npmVer = capture('npm', ['--version']).stdout?.trim() || '';
if (!npmVer) warnf('npm not found');
else ok(`npm ${npmVer}`);

// ── Claude Code CLI ───────────────────────────────────────────────────────────

const claudeVer = capture(CLAUDE, ['--version']).stdout?.trim() || '';
if (!claudeVer) warnf('claude CLI not found — install @anthropic-ai/claude-code globally');
else ok(`Claude Code ${claudeVer}`);

// ── ~/.claude/settings.json ───────────────────────────────────────────────────

const claudeDir = isWin
  ? (existsSync(join(process.env['APPDATA'] ?? homedir(), 'Claude')) ? join(process.env['APPDATA'] ?? homedir(), 'Claude') : join(homedir(), '.claude'))
  : join(homedir(), '.claude');
const settingsPath = join(claudeDir, 'settings.json');
if (existsSync(settingsPath)) ok(`settings.json: ${settingsPath}`);
else failf(`settings.json missing at ${settingsPath}`);

// ── Plugin symlink ────────────────────────────────────────────────────────────

const pluginLink = join(claudeDir, 'plugins', 'marketplaces', 'claude-plugins-official', 'plugins', 'curato');
if (existsSync(pluginLink)) ok(`Plugin installed: ${pluginLink}`);
else failf(`Plugin not installed — run: node ${join(CURATO_DIR, 'scripts', 'install.js')}`);

// ── MCP server binary ─────────────────────────────────────────────────────────

const mcpBin = join(CURATO_DIR, 'mcp-server', 'dist', 'index.js');
if (existsSync(mcpBin)) ok(`MCP server binary: ${mcpBin}`);
else failf(`MCP server not built — run: cd ${join(CURATO_DIR, 'mcp-server')} && npm run build`);

// ── MCP registration in settings.json ────────────────────────────────────────

if (existsSync(settingsPath)) {
  try {
    const s = JSON.parse(readFileSync(settingsPath, 'utf8'));
    const mcp = s.mcpServers || {};
    if ('curato' in mcp) ok('curato registered in settings.json');
    else failf(`curato not in settings.json mcpServers — run: node ${join(CURATO_DIR, 'scripts', 'install.js')}`);
  } catch {
    warnf('Could not parse settings.json');
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n=== Summary: ${pass} ok, ${warn} warn, ${fail} fail ===`);
if (fail > 0) {
  console.log(`Anomalies detected. Run: node ${join(CURATO_DIR, 'scripts', 'install.js')}`);
  process.exit(1);
} else if (warn > 0) {
  console.log('Curato: minor warnings found. Review above.');
} else {
  console.log('Curato is operational.');
}

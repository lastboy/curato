#!/usr/bin/env node
/**
 * register-mcp.js — CLI helper to safely add an MCP server entry to ~/.claude/settings.json
 *
 * Usage:
 *   node register-mcp.js --name <serverName> --command <cmd> [--args <arg1> <arg2> ...]
 *                        [--config <path-to-settings.json>]
 *
 * Safe: uses safeMerge — existing entries are never modified.
 * Always creates a timestamped backup before writing.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

// ── arg parsing ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
let serverName = '';
let command = '';
let cmdArgs = [];
let configPath = join(homedir(), '.claude', 'settings.json');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name')    { serverName = args[++i]; }
  else if (args[i] === '--command')  { command = args[++i]; }
  else if (args[i] === '--config')   { configPath = args[++i]; }
  else if (args[i] === '--args') {
    while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
      cmdArgs.push(args[++i]);
    }
  }
}

if (!serverName || !command) {
  console.error('Usage: node register-mcp.js --name <name> --command <cmd> [--args <a1> ...] [--config <path>]');
  process.exit(1);
}

// ── safe merge ─────────────────────────────────────────────────────────────────

function isPlainObject(val) {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function safeMerge(target, source) {
  const result = { ...target };
  for (const [key, sourceVal] of Object.entries(source)) {
    if (!(key in result)) {
      result[key] = sourceVal;
    } else if (isPlainObject(result[key]) && isPlainObject(sourceVal)) {
      result[key] = safeMerge(result[key], sourceVal);
    } else if (Array.isArray(result[key]) && Array.isArray(sourceVal)) {
      const seen = new Set();
      result[key] = [...result[key], ...sourceVal].filter(item => {
        const k = JSON.stringify(item);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
  }
  return result;
}

// ── backup ─────────────────────────────────────────────────────────────────────

function timestamp() {
  const now = new Date();
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
}

function backupIfExists(filePath) {
  if (!existsSync(filePath)) return;
  const backupDir = join(homedir(), '.curato-backups', timestamp());
  mkdirSync(backupDir, { recursive: true });
  copyFileSync(filePath, join(backupDir, basename(filePath)));
  console.log(`  [backup] ${join(backupDir, basename(filePath))}`);
}

// ── main ───────────────────────────────────────────────────────────────────────

let settings = {};
if (existsSync(configPath)) {
  try {
    settings = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    console.error(`  [warn] Could not parse ${configPath} — starting fresh`);
  }
}

const existingMcp = (settings.mcpServers && typeof settings.mcpServers === 'object')
  ? settings.mcpServers
  : {};

if (serverName in existingMcp) {
  console.log(`  [skip] ${serverName} already registered in ${configPath}`);
  process.exit(0);
}

backupIfExists(configPath);

const entry = { command };
if (cmdArgs.length > 0) entry.args = cmdArgs;

const updated = safeMerge(settings, {
  mcpServers: { [serverName]: entry }
});

mkdirSync(dirname(configPath), { recursive: true });
writeFileSync(configPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');

console.log(`  [OK] Registered ${serverName} in ${configPath}`);

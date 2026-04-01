#!/usr/bin/env node
// init-team.js — Cross-platform replacement for init-team.sh
// Apply curato-setup.json without the MCP server running.
// Note: 'extends' (remote config inheritance) is not supported here — use /setup-team for that.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === 'win32';
const CLAUDE = isWin ? 'claude.cmd' : 'claude';
const configFile = process.argv[2] ?? 'curato-setup.json';

if (!existsSync(configFile)) {
  console.error(`Error: ${configFile} not found.`);
  console.error('Copy curato-setup.example.json to curato-setup.json and configure it.');
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(configFile, 'utf8'));
} catch (e) {
  console.error(`Error: Could not parse ${configFile}: ${e.message}`);
  process.exit(1);
}

if (config.version !== 1) {
  console.error('Error: curato-setup.json must have "version": 1');
  process.exit(1);
}

if (config.extends) {
  console.warn(`Warning: "extends" (${config.extends}) is not supported in the Node.js fallback.`);
  console.warn('  For full support including remote config inheritance, use the MCP version: /setup-team\n');
}

console.log(`Applying team setup from ${configFile}...\n`);

function capture(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: 'utf8', stdio: 'inherit' });
}

const claudeDir = isWin
  ? (existsSync(join(process.env['APPDATA'] ?? homedir(), 'Claude')) ? join(process.env['APPDATA'] ?? homedir(), 'Claude') : join(homedir(), '.claude'))
  : join(homedir(), '.claude');

// ── MCP servers ───────────────────────────────────────────────────────────────

const mcpServers = config.mcpServers ?? {};
const mcpNames = Object.keys(mcpServers);
if (mcpNames.length > 0) {
  console.log('  Applying MCP servers...');
  const mcpList = capture(CLAUDE, ['mcp', 'list']).stdout ?? '';
  for (const [name, entry] of Object.entries(mcpServers)) {
    if (mcpList.includes(name)) {
      console.log(`  [skip] MCP "${name}" already registered`);
      continue;
    }
    const scope = entry.scope === 'project' ? 'local' : 'user';
    const args = ['mcp', 'add', '-s', scope, name, '--', entry.command, ...(entry.args ?? [])];
    const r = run(CLAUDE, args);
    if (r.status === 0) console.log(`  [OK]  MCP "${name}" registered`);
    else console.log(`  [FAIL] MCP "${name}" — check output above`);
  }
  console.log('');
}

// ── Plugins ───────────────────────────────────────────────────────────────────

const plugins = config.plugins ?? [];
if (plugins.length > 0) {
  console.log('  Applying plugins...');
  const pluginList = capture(CLAUDE, ['plugin', 'list']).stdout ?? '';
  for (const entry of plugins) {
    const name = typeof entry === 'string' ? entry : entry.name;
    if (pluginList.includes(name)) {
      console.log(`  [skip] Plugin "${name}" already installed`);
      continue;
    }
    const r = run(CLAUDE, ['plugin', 'install', name]);
    if (r.status === 0) console.log(`  [OK]  Plugin "${name}" installed`);
    else console.log(`  [FAIL] Plugin "${name}" — check output above`);
  }
  console.log('');
}

// ── CLAUDE.md (project) ───────────────────────────────────────────────────────

const projectMd = config.claudeMd?.project;
if (projectMd) {
  const targetPath = join(process.cwd(), 'CLAUDE.md');
  if (projectMd.mode === 'create-if-missing') {
    if (!existsSync(targetPath)) {
      writeFileSync(targetPath, projectMd.content, 'utf8');
      console.log(`  [OK]  Created ${targetPath}`);
    } else {
      console.log(`  [skip] ${targetPath} already exists`);
    }
  } else if (projectMd.mode === 'append-if-missing-section' && projectMd.section) {
    const existing = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : '';
    if (!existing.includes(projectMd.section)) {
      writeFileSync(targetPath, existing + '\n' + projectMd.content, 'utf8');
      console.log(`  [OK]  Appended section to ${targetPath}`);
    } else {
      console.log(`  [skip] Section "${projectMd.section}" already in ${targetPath}`);
    }
  }
}

// ── CLAUDE.md (user) ──────────────────────────────────────────────────────────

const userMd = config.claudeMd?.user;
if (userMd) {
  const targetPath = join(claudeDir, 'CLAUDE.md');
  if (userMd.mode === 'create-if-missing') {
    if (!existsSync(targetPath)) {
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, userMd.content, 'utf8');
      console.log(`  [OK]  Created ${targetPath}`);
    } else {
      console.log(`  [skip] ${targetPath} already exists`);
    }
  } else if (userMd.mode === 'append-if-missing-section' && userMd.section) {
    const existing = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : '';
    if (!existing.includes(userMd.section)) {
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, existing + '\n' + userMd.content, 'utf8');
      console.log(`  [OK]  Appended section to ${targetPath}`);
    } else {
      console.log(`  [skip] Section "${userMd.section}" already in ${targetPath}`);
    }
  }
}

console.log('\nCurato: Team setup applied.');
console.log('For full support (extends, skill filters, MCP repair), use /setup-team inside Claude Code.');

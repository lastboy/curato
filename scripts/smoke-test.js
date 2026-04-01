#!/usr/bin/env node
// smoke-test.js — Cross-platform replacement for smoke-test.sh

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURATO_DIR = join(__dirname, '..');
const SERVER_BIN = join(CURATO_DIR, 'mcp-server', 'dist', 'index.js');

let pass = 0, fail = 0;
const stepPass = (msg) => { console.log(`  [PASS] ${msg}`); pass++; };
const stepFail = (msg) => { console.log(`  [FAIL] ${msg}`); fail++; };

console.log('Running smoke test...\n');

// ── 1. node-reachable ─────────────────────────────────────────────────────────

const nodeVer = spawnSync('node', ['--version'], { encoding: 'utf8' }).stdout?.trim() || '';
if (!nodeVer) {
  stepFail('node-reachable       NOT FOUND');
} else {
  const major = parseInt(nodeVer.replace(/^v/, ''), 10);
  if (major >= 18) stepPass(`node-reachable       ${nodeVer}`);
  else stepFail(`node-reachable       ${nodeVer} (need >= 18)`);
}

// ── 2. mcp-server-built ───────────────────────────────────────────────────────

if (existsSync(SERVER_BIN)) {
  stepPass(`mcp-server-built     ${SERVER_BIN}`);
} else {
  stepFail('mcp-server-built     NOT BUILT — run: cd mcp-server && npm run build');
}

// ── 3. plugin-readable ────────────────────────────────────────────────────────

const pluginJson = join(CURATO_DIR, 'plugin', '.claude-plugin', 'plugin.json');
try {
  const p = JSON.parse(readFileSync(pluginJson, 'utf8'));
  if (p.name === 'curato' && p.description) stepPass('plugin-readable      plugin.json valid');
  else stepFail('plugin-readable      plugin.json has unexpected content');
} catch {
  stepFail('plugin-readable      plugin.json invalid or missing');
}

// ── 4. doctor-command-exists ──────────────────────────────────────────────────

const doctorMd = join(CURATO_DIR, 'plugin', 'commands', 'doctor.md');
if (existsSync(doctorMd) && readFileSync(doctorMd, 'utf8').includes('description:')) {
  stepPass('doctor-command-exists plugin/commands/doctor.md');
} else {
  stepFail('doctor-command-exists NOT FOUND or missing description');
}

// ── 5. mcp-server-roundtrip ───────────────────────────────────────────────────

if (existsSync(SERVER_BIN)) {
  const initMsg = JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke', version: '0.1' } },
  });
  const r = spawnSync(process.execPath, [SERVER_BIN], {
    input: initMsg + '\n',
    encoding: 'utf8',
    timeout: 5000,
  });
  const firstLine = (r.stdout || '').split('\n')[0]?.trim();
  try {
    const parsed = JSON.parse(firstLine || '{}');
    if (parsed.result) stepPass('mcp-roundtrip        initialize OK');
    else stepFail('mcp-roundtrip        no result in response');
  } catch {
    stepFail('mcp-roundtrip        no valid JSON response from server');
  }
} else {
  stepFail('mcp-roundtrip        (skipped — server not built)');
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n=== ${pass}/${pass + fail} checks passed ===\n`);
if (fail === 0) {
  console.log('Curato is operational.');
} else {
  console.log('Anomalies detected. Review failures above.');
  process.exit(1);
}

#!/usr/bin/env node
/**
 * curato — CLI entry point
 *
 * Usage:
 *   npx curato install     Install Curato (build, register plugin + MCP server)
 *   npx curato doctor      Standalone health check (no Claude Code required)
 *   npx curato smoke-test  Run validation suite
 *   npx curato uninstall   Full teardown
 */

import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NODE = process.execPath;

const commands = {
  install:      'scripts/install.js',
  doctor:       'scripts/doctor.js',
  'smoke-test': 'scripts/smoke-test.js',
  uninstall:    'scripts/uninstall.js',
};

const command = process.argv[2];

if (!command || command === '--help' || command === '-h') {
  console.log(`
  curato — Dev environment manager for Claude Code

  Usage:
    npx curato install       Build and register Curato (plugin + MCP server)
    npx curato doctor        Standalone health check
    npx curato smoke-test    Run 7-step validation suite
    npx curato uninstall     Full teardown

  After install, open Claude Code and run /doctor to verify.

  https://github.com/lastboy/curato
`);
  process.exit(0);
}

if (!commands[command]) {
  console.error(`Unknown command: ${command}`);
  console.error(`Run "npx curato --help" for available commands.`);
  process.exit(1);
}

const script = join(ROOT, commands[command]);
const result = spawnSync(NODE, [script, ...process.argv.slice(3)], {
  stdio: 'inherit',
  cwd: ROOT,
});

process.exit(result.status ?? 1);

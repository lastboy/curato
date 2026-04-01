#!/usr/bin/env node
// chrome-debug.js — Cross-platform Chrome debug launcher (replaces chrome-debug.sh on Windows)
// Launches a separate Chrome instance with remote debugging, leaving your existing Chrome intact.
//
// Usage: node chrome-debug.js [url] [port]
//   url  — page to open (default: http://localhost:3000)
//   port — remote debugging port (default: 9222)

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';

const startUrl = process.env['START_URL'] ?? process.argv[2] ?? 'http://localhost:3000';
const port = parseInt(process.env['PORT'] ?? process.argv[3] ?? '9222', 10);
const profileDir = join(tmpdir(), 'chrome-debug-profile');

function findChrome() {
  if (process.platform === 'darwin') {
    const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (existsSync(mac)) return mac;
  }
  if (process.platform === 'win32') {
    for (const candidate of [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ]) {
      if (existsSync(candidate)) return candidate;
    }
    return null;
  }
  // Linux — try common names on PATH
  for (const name of ['google-chrome', 'chromium-browser', 'chromium']) {
    const r = spawnSync('which', [name], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

const chromePath = findChrome();
if (!chromePath) {
  console.error('Chrome not found. Install Google Chrome and try again.');
  process.exit(1);
}

const child = spawn(chromePath, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  startUrl,
], { detached: true, stdio: 'ignore' });
child.unref();

console.log(`Chrome debug instance launched on port ${port}`);
console.log(`URL: ${startUrl}`);
console.log('');
console.log("Now use Claude's chrome-devtools MCP tools to inspect the page.");

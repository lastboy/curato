import { existsSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as net from 'node:net';
import { register } from './index.js';
import { toolResult } from '../types.js';
import { readSettingsJson } from '../scanner/claude-config.js';
import { claudeBin, whichCmd, chromeCandidates, tmpDir, isWin, getClaudeDir, getClaudeJsonPath } from '../utils/platform.js';

const CHROME_MCP_PACKAGE = 'chrome-devtools-mcp';
const DEFAULT_DEBUG_PORT = 9222;
const DEFAULT_BROWSER_URL = `http://127.0.0.1:${DEFAULT_DEBUG_PORT}`;

interface ChromeSetupResult {
  npmInstalled: boolean;
  binaryPath?: string;
  mcpRegistered: boolean;
  mcpAlreadyPresent: boolean;
  launcherCreated: boolean;
  launcherPath?: string;
  reloadRequired: boolean;
  steps: Array<{ step: string; status: 'ok' | 'skip' | 'error'; detail: string }>;
}

interface ChromeStatusResult {
  npmInstalled: boolean;
  binaryPath?: string;
  mcpRegistered: boolean;
  mcpEntry?: { command: string; args?: string[] };
  chromeInstalled: boolean;
  debugPort: number;
  debugRunning: boolean;
  launcherExists: boolean;
  launcherPath?: string;
  ready: boolean;
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

function findLauncherScript(cwd: string): string | undefined {
  // Check .js first (cross-platform), then .sh (Unix fallback)
  for (const name of ['chrome-debug.js', 'chrome-debug.sh']) {
    const local = join(cwd, name);
    if (existsSync(local)) return local;
  }
  // Also check the curato repo root relative to this file's location
  // Use fileURLToPath to avoid leading-slash bug on Windows (/C:/...)
  const curatoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
  for (const name of ['chrome-debug.js', 'chrome-debug.sh']) {
    const rootScript = join(curatoRoot, name);
    if (existsSync(rootScript)) return rootScript;
  }
  return undefined;
}

function findBinary(): string | undefined {
  const result = spawnSync(whichCmd(), [CHROME_MCP_PACKAGE], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout) {
    return result.stdout.trim().split('\n')[0]?.trim();
  }
  return undefined;
}

/** Read mcpServers from ~/.claude.json (CLI registry) */
function readClaudeJsonMcp(): Record<string, unknown> {
  const path = getClaudeJsonPath();
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const d = parsed as Record<string, unknown>;
      if (d['mcpServers'] && typeof d['mcpServers'] === 'object' && !Array.isArray(d['mcpServers'])) {
        return d['mcpServers'] as Record<string, unknown>;
      }
    }
    return {};
  } catch {
    return {};
  }
}

function getMcpEntry(): { command: string; args?: string[] } | undefined {
  // Check CLI registry (~/.claude.json)
  const cliMcp = readClaudeJsonMcp();
  if (cliMcp['chrome-devtools'] && typeof cliMcp['chrome-devtools'] === 'object') {
    const e = cliMcp['chrome-devtools'] as Record<string, unknown>;
    return {
      command: String(e['command'] ?? ''),
      args: Array.isArray(e['args']) ? e['args'].map(String) : undefined,
    };
  }
  // Check VS Code registry (~/.claude/settings.json)
  const vscodeMcp = readSettingsJson();
  const servers = vscodeMcp['mcpServers'];
  if (servers && typeof servers === 'object' && !Array.isArray(servers)) {
    const s = servers as Record<string, unknown>;
    if (s['chrome-devtools'] && typeof s['chrome-devtools'] === 'object') {
      const e = s['chrome-devtools'] as Record<string, unknown>;
      return {
        command: String(e['command'] ?? ''),
        args: Array.isArray(e['args']) ? e['args'].map(String) : undefined,
      };
    }
  }
  return undefined;
}

/**
 * Copy chrome-debug.js from the curato package root to destPath.
 * Falls back to writing a minimal inline Node.js launcher if the source isn't found
 * (e.g. running from a non-standard install path).
 */
function copyOrGenerateLauncher(destPath: string): void {
  // Locate the curato repo/package root relative to this compiled file
  const curatoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
  const sourceScript = join(curatoRoot, 'chrome-debug.js');

  if (existsSync(sourceScript)) {
    cpSync(sourceScript, destPath);
    return;
  }

  // Fallback: generate a minimal cross-platform Node.js launcher inline
  const profileDir = join(tmpDir(), 'chrome-debug-profile').replace(/\\/g, '\\\\');
  writeFileSync(destPath, `#!/usr/bin/env node
// chrome-debug.js — Launch a separate Chrome instance with remote debugging.
// Your existing Chrome profile is NOT affected (uses a temp profile directory).
// Generated by Curato.

import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

const startUrl = process.env['START_URL'] ?? process.argv[2] ?? 'http://localhost:3000';
const port = parseInt(process.env['PORT'] ?? process.argv[3] ?? '9222', 10);
const profileDir = '${profileDir}';

function findChrome() {
  if (process.platform === 'darwin') {
    const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (existsSync(mac)) return mac;
  }
  if (process.platform === 'win32') {
    for (const c of ['C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
                      'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe']) {
      if (existsSync(c)) return c;
    }
    return null;
  }
  for (const name of ['google-chrome', 'chromium-browser', 'chromium']) {
    const r = spawnSync('which', [name], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

const chromePath = findChrome();
if (!chromePath) { console.error('Chrome not found.'); process.exit(1); }

const child = spawn(chromePath, [
  \`--remote-debugging-port=\${port}\`,
  \`--user-data-dir=\${profileDir}\`,
  '--no-first-run', '--no-default-browser-check', startUrl,
], { detached: true, stdio: 'ignore' });
child.unref();
console.log(\`Chrome debug launched on port \${port} — URL: \${startUrl}\`);
`, 'utf8');
}

// ── Tool: check_chrome_devtools ────────────────────────────────────────────────

register(
  {
    name: 'check_chrome_devtools',
    description:
      'Check whether chrome-devtools-mcp is installed, registered, and ready to use. Returns a status report.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Working directory to look for chrome-debug launcher' },
      },
    },
  },
  async (args) => {
    const params = args as { cwd?: string };
    const cwd = params.cwd ?? process.cwd();

    const binaryPath = findBinary();
    const mcpEntry = getMcpEntry();
    // Prefer .js launcher (cross-platform); fall back to .sh for existing Unix setups
    const launcherPath = existsSync(join(cwd, 'chrome-debug.js'))
      ? join(cwd, 'chrome-debug.js')
      : join(cwd, 'chrome-debug.sh');
    const candidates = chromeCandidates();
    const chromeInstalled = candidates.some((c) => existsSync(c));

    const debugRunning = await isPortOpen(DEFAULT_DEBUG_PORT);

    const result: ChromeStatusResult = {
      npmInstalled: !!binaryPath,
      binaryPath,
      mcpRegistered: !!mcpEntry,
      mcpEntry,
      chromeInstalled,
      debugPort: DEFAULT_DEBUG_PORT,
      debugRunning,
      launcherExists: existsSync(launcherPath),
      launcherPath: existsSync(launcherPath) ? launcherPath : undefined,
      ready: !!binaryPath && !!mcpEntry && debugRunning,
    };

    return toolResult(result);
  },
);

// ── Tool: setup_chrome_devtools ────────────────────────────────────────────────

register(
  {
    name: 'setup_chrome_devtools',
    description:
      'Install chrome-devtools-mcp, register it with Claude, and create a chrome-debug.sh launcher script. Handles the full setup that is otherwise painful to do manually.',
    inputSchema: {
      type: 'object',
      required: ['dryRun'],
      properties: {
        cwd: { type: 'string', description: 'Working directory for chrome-debug.sh (defaults to process.cwd())' },
        startUrl: { type: 'string', description: 'URL to open in debug Chrome (defaults to http://localhost:3000)' },
        port: { type: 'number', description: 'Remote debugging port (defaults to 9222)' },
        dryRun: { type: 'boolean', description: 'If true, return plan without making changes' },
      },
    },
  },
  async (args) => {
    const params = args as { cwd?: string; startUrl?: string; port?: number; dryRun: boolean };
    const cwd = params.cwd ?? process.cwd();
    const port = params.port ?? DEFAULT_DEBUG_PORT;
    const startUrl = params.startUrl ?? 'http://localhost:3000';
    const browserUrl = `http://127.0.0.1:${port}`;

    const steps: ChromeSetupResult['steps'] = [];

    // ── Step 1: Check/install npm package ──────────────────────────────────────

    const existingBinary = findBinary();

    if (existingBinary) {
      steps.push({ step: 'npm-install', status: 'skip', detail: `${CHROME_MCP_PACKAGE} already installed at ${existingBinary}` });
    } else if (params.dryRun) {
      steps.push({ step: 'npm-install', status: 'ok', detail: `Would run: npm install -g ${CHROME_MCP_PACKAGE}` });
    } else {
      const r = spawnSync('npm', ['install', '-g', CHROME_MCP_PACKAGE], { encoding: 'utf8' });
      if (r.status === 0) {
        steps.push({ step: 'npm-install', status: 'ok', detail: `${CHROME_MCP_PACKAGE} installed` });
      } else {
        steps.push({ step: 'npm-install', status: 'error', detail: r.stderr?.trim() ?? 'npm install failed' });
        return toolResult({ error: 'npm install failed', steps });
      }
    }

    // ── Step 2: Register MCP server ────────────────────────────────────────────

    const binaryPath = existingBinary ?? findBinary();
    const existingEntry = getMcpEntry();

    if (existingEntry) {
      steps.push({ step: 'mcp-register', status: 'skip', detail: `chrome-devtools already registered (${existingEntry.command})` });
    } else if (!binaryPath && params.dryRun) {
      steps.push({ step: 'mcp-register', status: 'ok', detail: `Would register chrome-devtools with absolute path to ${CHROME_MCP_PACKAGE}` });
    } else if (binaryPath) {
      if (params.dryRun) {
        steps.push({ step: 'mcp-register', status: 'ok', detail: `Would register chrome-devtools in CLI registry (~/.claude.json) and VS Code registry (~/.claude/settings.json) with path: ${binaryPath}` });
      } else {
        // Register in CLI registry via `claude mcp add`
        const r = spawnSync(
          claudeBin(),
          ['mcp', 'add', '-s', 'user', 'chrome-devtools', '--', binaryPath, '--browserUrl', browserUrl],
          { encoding: 'utf8' },
        );
        const cliOk = r.status === 0;

        // Register in VS Code registry via settings.json safe-merge
        try {
          const settingsPath = join(getClaudeDir(), 'settings.json');
          const existing = existsSync(settingsPath)
            ? (JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>)
            : {};
          const mcpServers = (existing['mcpServers'] as Record<string, unknown> | undefined) ?? {};
          if (!mcpServers['chrome-devtools']) {
            mcpServers['chrome-devtools'] = { command: binaryPath, args: ['--browserUrl', browserUrl] };
            existing['mcpServers'] = mcpServers;
            writeFileSync(settingsPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
          }
          steps.push({
            step: 'mcp-register',
            status: 'ok',
            detail: `chrome-devtools registered in ${cliOk ? 'CLI + ' : ''}VS Code registry with path: ${binaryPath}`,
          });
        } catch (err) {
          steps.push({ step: 'mcp-register', status: 'error', detail: String(err) });
        }
      }
    }

    // ── Step 3: Create chrome-debug.js launcher ────────────────────────────────

    const launcherPath = join(cwd, 'chrome-debug.js');

    if (existsSync(launcherPath)) {
      steps.push({ step: 'launcher', status: 'skip', detail: `${launcherPath} already exists` });
    } else if (params.dryRun) {
      steps.push({ step: 'launcher', status: 'ok', detail: `Would create ${launcherPath}` });
    } else {
      copyOrGenerateLauncher(launcherPath);
      steps.push({ step: 'launcher', status: 'ok', detail: `Created ${launcherPath}` });
    }

    const result: ChromeSetupResult = {
      npmInstalled: !!existingBinary || !params.dryRun,
      binaryPath: binaryPath ?? undefined,
      mcpRegistered: !!existingEntry || !params.dryRun,
      mcpAlreadyPresent: !!existingEntry,
      launcherCreated: !existsSync(launcherPath) || params.dryRun,
      launcherPath,
      reloadRequired: !existingEntry && !params.dryRun,
      steps,
    };

    return toolResult(result);
  },
);

// ── Tool: launch_chrome_debug ──────────────────────────────────────────────────

register(
  {
    name: 'launch_chrome_debug',
    description:
      'Launch a Chrome debug instance with remote debugging on port 9222. Uses a launcher script if present, otherwise launches Chrome directly. Returns { alreadyRunning, launched, port, error? }.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Working directory to find chrome-debug launcher' },
        startUrl: { type: 'string', description: 'URL to open in Chrome (default: http://localhost:3000)' },
        port: { type: 'number', description: 'Debug port (default: 9222)' },
      },
    },
  },
  async (args) => {
    const params = args as { cwd?: string; startUrl?: string; port?: number };
    const cwd = params.cwd ?? process.cwd();
    const port = params.port ?? DEFAULT_DEBUG_PORT;
    const startUrl = params.startUrl ?? 'http://localhost:3000';
    const profileDir = join(tmpDir(), 'chrome-debug-profile');

    // Already running?
    if (await isPortOpen(port)) {
      return toolResult({ alreadyRunning: true, launched: false, port });
    }

    const launcher = findLauncherScript(cwd);

    if (launcher && launcher.endsWith('.js')) {
      // Node.js launcher — spawn directly
      const child = spawn(process.execPath, [launcher], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, START_URL: startUrl, PORT: String(port) },
      });
      child.unref();
    } else if (launcher && launcher.endsWith('.sh') && !isWin()) {
      // Shell launcher — only on Unix
      const child = spawn('bash', [launcher], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, START_URL: startUrl, PORT: String(port) },
      });
      child.unref();
    } else {
      // No launcher — try to spawn Chrome directly from candidates
      const chromePath = chromeCandidates().find((c) => existsSync(c));
      if (!chromePath) {
        return toolResult({
          alreadyRunning: false,
          launched: false,
          port,
          error: 'Chrome not found. Install Google Chrome or create a chrome-debug.js launcher.',
        });
      }
      const child = spawn(chromePath, [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        startUrl,
      ], { detached: true, stdio: 'ignore' });
      child.unref();
    }

    // Wait up to 5 seconds for Chrome to open the debug port
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await isPortOpen(port)) {
        return toolResult({ alreadyRunning: false, launched: true, port, launcherUsed: launcher ?? 'direct' });
      }
    }

    return toolResult({
      alreadyRunning: false,
      launched: false,
      port,
      error: `Chrome debug port ${port} not open after 5s — Chrome may still be starting`,
    });
  },
);

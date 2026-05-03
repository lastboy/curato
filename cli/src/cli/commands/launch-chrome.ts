import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromeCandidates, tmpDir, whichCmd, isWin } from '../../utils/platform.js';
import { ok, fail, info, dim } from '../print.js';

const HELP = `
USAGE
  curato launch-chrome [url] [options]

ARGUMENTS
  url              Page to open (default: http://localhost:3000)

OPTIONS
  --port <port>    Remote debugging port (default: 9222)
  --help           Show this help

EXAMPLES
  curato launch-chrome
  curato launch-chrome http://localhost:5174
  curato launch-chrome http://localhost:3000 --port 9333

DETAILS
  Launches a separate Chrome instance with remote debugging enabled, using an
  isolated profile dir so your existing Chrome sessions are untouched.

  The chrome-devtools MCP server connects to the debug port and exposes browser
  tools (click, screenshot, navigate, console, network) to Claude Code.
`;

function resolveChromeBinary(): string | null {
  for (const candidate of chromeCandidates()) {
    if (candidate.includes('/') || candidate.includes('\\')) {
      if (existsSync(candidate)) return candidate;
      continue;
    }
    const r = spawnSync(whichCmd(), [candidate], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().split(/\r?\n/)[0];
  }
  return null;
}

export async function launchChrome(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      port: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) { console.log(HELP); return; }

  const startUrl = positionals[0] ?? 'http://localhost:3000';
  const port = parseInt((values.port as string | undefined) ?? '9222', 10);
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    fail(`Invalid port: ${values.port}`);
    process.exit(1);
  }

  const chromePath = resolveChromeBinary();
  if (!chromePath) {
    fail('Chrome not found. Install Google Chrome (or chromium on Linux) and try again.');
    dim('Looked for: ' + chromeCandidates().join(', '));
    process.exit(1);
  }

  const profileDir = join(tmpDir(), 'chrome-debug-profile');
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    startUrl,
  ];

  info(`Launching Chrome: ${chromePath}`);
  dim(`  port: ${port}`);
  dim(`  profile: ${profileDir}`);
  dim(`  url: ${startUrl}`);

  const child = spawn(chromePath, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: isWin() ? false : undefined,
  });
  child.unref();

  ok(`Chrome debug instance launched on port ${port}`);
  dim('The chrome-devtools MCP can now connect to http://127.0.0.1:' + port);
}

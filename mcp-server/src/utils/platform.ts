import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

// ── Platform override (for tests) ────────────────────────────────────────────

export let _platform: NodeJS.Platform = process.platform;

export function setPlatformOverride(p: NodeJS.Platform): void {
  _platform = p;
}

export function resetPlatformOverride(): void {
  _platform = process.platform;
}

export function isWin(): boolean {
  return _platform === 'win32';
}

// ── Executable resolution ─────────────────────────────────────────────────────

/** Claude CLI binary name. Windows requires the `.cmd` wrapper. */
export function claudeBin(): string {
  return isWin() ? 'claude.cmd' : 'claude';
}

/** Command to locate executables on PATH. */
export function whichCmd(): string {
  return isWin() ? 'where' : 'which';
}

// ── Path helpers ──────────────────────────────────────────────────────────────

/** PATH separator character. */
export function pathSep(): string {
  return isWin() ? ';' : ':';
}

/** Cross-platform temp directory. */
export function tmpDir(): string {
  return tmpdir();
}

// ── Claude config paths ───────────────────────────────────────────────────────

/**
 * Directory where Claude Code stores its config (settings.json, plugins/, etc.)
 *
 * macOS/Linux: ~/.claude
 * Windows: %APPDATA%\Claude if it exists, otherwise ~/.claude
 *
 * TODO: verify the Windows path on a real Windows machine — Claude Code may use
 * %APPDATA%\Claude or %USERPROFILE%\.claude depending on the installer version.
 */
export function getClaudeDir(): string {
  if (isWin()) {
    const appdata = join(process.env['APPDATA'] ?? homedir(), 'Claude');
    if (existsSync(appdata)) return appdata;
  }
  return join(homedir(), '.claude');
}

/**
 * Path to the CLI registry file written by `claude mcp add`.
 *
 * macOS/Linux: ~/.claude.json
 * Windows: assumed to be the same path (Claude CLI follows %USERPROFILE%).
 * TODO: verify on a real Windows machine.
 */
export function getClaudeJsonPath(): string {
  return join(homedir(), '.claude.json');
}

// ── Chrome candidates ─────────────────────────────────────────────────────────

/**
 * Ordered list of Chrome binary paths to try on the current platform.
 * The caller should try each in order and use the first one that exists.
 */
export function chromeCandidates(): string[] {
  if (isWin()) {
    return [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
  }
  if (_platform === 'darwin') {
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  }
  // Linux — resolved at runtime via PATH
  return ['google-chrome', 'chromium-browser', 'chromium'];
}

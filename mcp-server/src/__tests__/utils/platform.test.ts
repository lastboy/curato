import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  setPlatformOverride,
  resetPlatformOverride,
  isWin,
  claudeBin,
  whichCmd,
  pathSep,
  tmpDir,
  chromeCandidates,
  getClaudeDir,
  getClaudeJsonPath,
} from '../../utils/platform.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

afterEach(() => resetPlatformOverride());

// ── isWin ─────────────────────────────────────────────────────────────────────

describe('isWin()', () => {
  test('returns true when platform is win32', () => {
    setPlatformOverride('win32');
    assert.equal(isWin(), true);
  });

  test('returns false when platform is darwin', () => {
    setPlatformOverride('darwin');
    assert.equal(isWin(), false);
  });

  test('returns false when platform is linux', () => {
    setPlatformOverride('linux');
    assert.equal(isWin(), false);
  });
});

// ── claudeBin ─────────────────────────────────────────────────────────────────

describe('claudeBin()', () => {
  test('returns claude.cmd on win32', () => {
    setPlatformOverride('win32');
    assert.equal(claudeBin(), 'claude.cmd');
  });

  test('returns claude on darwin', () => {
    setPlatformOverride('darwin');
    assert.equal(claudeBin(), 'claude');
  });

  test('returns claude on linux', () => {
    setPlatformOverride('linux');
    assert.equal(claudeBin(), 'claude');
  });
});

// ── whichCmd ──────────────────────────────────────────────────────────────────

describe('whichCmd()', () => {
  test('returns where on win32', () => {
    setPlatformOverride('win32');
    assert.equal(whichCmd(), 'where');
  });

  test('returns which on darwin', () => {
    setPlatformOverride('darwin');
    assert.equal(whichCmd(), 'which');
  });

  test('returns which on linux', () => {
    setPlatformOverride('linux');
    assert.equal(whichCmd(), 'which');
  });
});

// ── pathSep ───────────────────────────────────────────────────────────────────

describe('pathSep()', () => {
  test('returns semicolon on win32', () => {
    setPlatformOverride('win32');
    assert.equal(pathSep(), ';');
  });

  test('returns colon on darwin', () => {
    setPlatformOverride('darwin');
    assert.equal(pathSep(), ':');
  });

  test('returns colon on linux', () => {
    setPlatformOverride('linux');
    assert.equal(pathSep(), ':');
  });
});

// ── tmpDir ────────────────────────────────────────────────────────────────────

describe('tmpDir()', () => {
  test('returns a non-empty string', () => {
    assert.ok(tmpDir().length > 0);
  });
});

// ── chromeCandidates ──────────────────────────────────────────────────────────

describe('chromeCandidates()', () => {
  test('returns macOS app bundle path on darwin', () => {
    setPlatformOverride('darwin');
    const candidates = chromeCandidates();
    assert.ok(candidates.length > 0);
    assert.ok(candidates[0]?.includes('Google Chrome.app'));
  });

  test('returns Program Files paths on win32', () => {
    setPlatformOverride('win32');
    const candidates = chromeCandidates();
    assert.ok(candidates.length > 0);
    assert.ok(candidates.every((c) => c.includes('chrome.exe')));
    assert.ok(candidates.some((c) => c.includes('Program Files')));
  });

  test('returns command names on linux', () => {
    setPlatformOverride('linux');
    const candidates = chromeCandidates();
    assert.ok(candidates.length > 0);
    assert.ok(candidates.some((c) => c.includes('chrome') || c.includes('chromium')));
  });
});

// ── getClaudeDir ──────────────────────────────────────────────────────────────

describe('getClaudeDir()', () => {
  test('returns ~/.claude on darwin', () => {
    setPlatformOverride('darwin');
    assert.equal(getClaudeDir(), join(homedir(), '.claude'));
  });

  test('returns ~/.claude on linux', () => {
    setPlatformOverride('linux');
    assert.equal(getClaudeDir(), join(homedir(), '.claude'));
  });

  test('returns a string on win32 (either %APPDATA%/Claude or ~/.claude)', () => {
    setPlatformOverride('win32');
    const dir = getClaudeDir();
    assert.ok(typeof dir === 'string' && dir.length > 0);
    // Must end with either 'Claude' or '.claude'
    assert.ok(dir.endsWith('Claude') || dir.endsWith('.claude'));
  });
});

// ── getClaudeJsonPath ─────────────────────────────────────────────────────────

describe('getClaudeJsonPath()', () => {
  test('returns ~/.claude.json', () => {
    assert.equal(getClaudeJsonPath(), join(homedir(), '.claude.json'));
  });
});

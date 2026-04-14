import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  readSettingsJson,
  readClaudeJson,
  findClaudeMdUp,
  scanUserSetup,
} from '../../scanner/claude-config.js';

// ── readSettingsJson ──────────────────────────────────────────────────────────
// These tests call the real function — they read from the actual ~/.claude/settings.json
// if it exists. The contract under test is: always return a plain object, never throw.

describe('readSettingsJson()', () => {
  test('returns a plain object (never throws)', () => {
    const result = readSettingsJson();
    assert.equal(typeof result, 'object');
    assert.ok(!Array.isArray(result));
    assert.ok(result !== null);
  });
});

// ── readClaudeJson ─────────────────────────────────────────────────────────────

describe('readClaudeJson()', () => {
  test('returns a plain object (never throws)', () => {
    const result = readClaudeJson();
    assert.equal(typeof result, 'object');
    assert.ok(!Array.isArray(result));
    assert.ok(result !== null);
  });
});

// ── scanUserSetup ─────────────────────────────────────────────────────────────

describe('scanUserSetup()', () => {
  test('returns UserSetupInfo with required shape', () => {
    const info = scanUserSetup();
    assert.equal(typeof info.settingsJsonPath, 'string', 'settingsJsonPath is a string');
    assert.equal(typeof info.settingsJsonExists, 'boolean', 'settingsJsonExists is boolean');
    assert.equal(typeof info.claudeMdPath, 'string', 'claudeMdPath is a string');
    assert.equal(typeof info.claudeMdExists, 'boolean', 'claudeMdExists is boolean');
    assert.equal(typeof info.pluginsDir, 'string', 'pluginsDir is a string');
    assert.equal(typeof info.pluginsDirExists, 'boolean', 'pluginsDirExists is boolean');
    assert.ok(Array.isArray(info.installedPlugins), 'installedPlugins is an array');
  });

  test('paths point inside the claude dir', () => {
    const info = scanUserSetup();
    assert.ok(info.settingsJsonPath.includes('claude'), 'settingsJsonPath contains "claude"');
    assert.ok(info.claudeMdPath.includes('claude'), 'claudeMdPath contains "claude"');
  });
});

// ── findClaudeMdUp ────────────────────────────────────────────────────────────
// These tests use real temp dirs — no ~/.claude involvement.

describe('findClaudeMdUp()', () => {
  let root: string;

  before(() => {
    root = mkdtempSync(join(tmpdir(), 'curato-claude-config-'));
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('returns null when no CLAUDE.md exists anywhere up the tree', () => {
    const deep = join(root, 'a', 'b', 'c');
    mkdirSync(deep, { recursive: true });
    const result = findClaudeMdUp(deep);
    assert.equal(result, null);
  });

  test('finds CLAUDE.md in the start directory itself', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-claude-md-'));
    try {
      const claudeMd = join(dir, 'CLAUDE.md');
      writeFileSync(claudeMd, '# Project');
      const result = findClaudeMdUp(dir);
      assert.equal(result, claudeMd);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('finds CLAUDE.md one level up', () => {
    const parent = mkdtempSync(join(tmpdir(), 'curato-parent-'));
    try {
      const child = join(parent, 'subdir');
      mkdirSync(child, { recursive: true });
      const claudeMd = join(parent, 'CLAUDE.md');
      writeFileSync(claudeMd, '# Parent');
      const result = findClaudeMdUp(child);
      assert.equal(result, claudeMd);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  test('finds nearest CLAUDE.md (child wins over parent)', () => {
    const parent = mkdtempSync(join(tmpdir(), 'curato-nearest-'));
    try {
      const child = join(parent, 'subdir');
      mkdirSync(child, { recursive: true });
      writeFileSync(join(parent, 'CLAUDE.md'), '# Parent');
      const childMd = join(child, 'CLAUDE.md');
      writeFileSync(childMd, '# Child');
      const result = findClaudeMdUp(child);
      assert.equal(result, childMd);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

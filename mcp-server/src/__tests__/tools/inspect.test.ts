import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dispatch } from '../../tools/index.js';

import '../../tools/inspect.js';
import '../../tools/scan.js';
import '../../tools/plugin.js';
import '../../tools/mcp.js';
import '../../tools/recommend.js';
import '../../tools/apply.js';
import '../../tools/smoketest.js';

// ── inspect_user_setup ────────────────────────────────────────────────────────

describe('inspect_user_setup', () => {
  test('returns parseable JSON with UserSetupInfo shape', async () => {
    const result = await dispatch('inspect_user_setup', {});
    assert.ok(result.content[0]);
    const info = JSON.parse(result.content[0].text) as Record<string, unknown>;
    assert.equal(typeof info['settingsJsonPath'], 'string', 'settingsJsonPath is a string');
    assert.equal(typeof info['settingsJsonExists'], 'boolean', 'settingsJsonExists is boolean');
    assert.equal(typeof info['claudeMdPath'], 'string', 'claudeMdPath is a string');
    assert.equal(typeof info['claudeMdExists'], 'boolean', 'claudeMdExists is boolean');
    assert.equal(typeof info['pluginsDir'], 'string', 'pluginsDir is a string');
    assert.equal(typeof info['pluginsDirExists'], 'boolean', 'pluginsDirExists is boolean');
    assert.ok(Array.isArray(info['installedPlugins']), 'installedPlugins is an array');
  });

  test('paths are absolute strings', async () => {
    const result = await dispatch('inspect_user_setup', {});
    const info = JSON.parse(result.content[0].text) as Record<string, string>;
    assert.ok(info['settingsJsonPath'].startsWith('/') || /^[A-Za-z]:/.test(info['settingsJsonPath']),
      'settingsJsonPath is absolute');
    assert.ok(info['claudeMdPath'].startsWith('/') || /^[A-Za-z]:/.test(info['claudeMdPath']),
      'claudeMdPath is absolute');
  });
});

// ── inspect_project_setup ─────────────────────────────────────────────────────

describe('inspect_project_setup', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'curato-inspect-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns ProjectLayoutInfo shape for empty dir', async () => {
    const result = await dispatch('inspect_project_setup', { cwd: tmpDir });
    assert.ok(result.content[0]);
    const info = JSON.parse(result.content[0].text) as Record<string, unknown>;
    assert.equal(typeof info['cwd'], 'string', 'cwd is a string');
    assert.equal(info['hasClaudeDir'], false, 'empty dir has no .claude/');
    assert.equal(info['hasClaudeMd'], false, 'empty dir has no CLAUDE.md');
    assert.equal(info['hasMcpJson'], false, 'empty dir has no .mcp.json');
    assert.ok(Array.isArray(info['agentFiles']), 'agentFiles is an array');
  });

  test('detects .claude/ when present', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-inspect-claude-'));
    try {
      mkdirSync(join(dir, '.claude'), { recursive: true });
      const result = await dispatch('inspect_project_setup', { cwd: dir });
      const info = JSON.parse(result.content[0].text) as Record<string, unknown>;
      assert.equal(info['hasClaudeDir'], true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('detects CLAUDE.md when present', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-inspect-md-'));
    try {
      writeFileSync(join(dir, 'CLAUDE.md'), '# Project');
      const result = await dispatch('inspect_project_setup', { cwd: dir });
      const info = JSON.parse(result.content[0].text) as Record<string, unknown>;
      assert.equal(info['hasClaudeMd'], true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('detects .mcp.json when present', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-inspect-mcp-'));
    try {
      writeFileSync(join(dir, '.mcp.json'), JSON.stringify({ mcpServers: {} }));
      const result = await dispatch('inspect_project_setup', { cwd: dir });
      const info = JSON.parse(result.content[0].text) as Record<string, unknown>;
      assert.equal(info['hasMcpJson'], true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('detects agent files in .claude/agents/', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-inspect-agents-'));
    try {
      mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
      writeFileSync(join(dir, '.claude', 'agents', 'my-agent.md'), '# Agent');
      const result = await dispatch('inspect_project_setup', { cwd: dir });
      const info = JSON.parse(result.content[0].text) as Record<string, unknown[]>;
      assert.ok(info['agentFiles'].length > 0, 'agentFiles should be populated');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('defaults to process.cwd() when no cwd provided', async () => {
    const result = await dispatch('inspect_project_setup', {});
    assert.ok(result.content[0]);
    const info = JSON.parse(result.content[0].text) as Record<string, unknown>;
    assert.equal(typeof info['cwd'], 'string');
    assert.ok((info['cwd'] as string).length > 0);
  });
});

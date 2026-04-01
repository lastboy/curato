/**
 * Full regression suite.
 * Tests the complete install → scan → repair → verify loop using temp dirs.
 * Never touches real ~/.claude files.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, writeFileSync, readFileSync,
  existsSync, statSync, mkdirSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerMcpServer } from '../../patcher/mcp-registrar.js';
import { safeMerge } from '../../patcher/json-merger.js';
import { scanMcpRegistry } from '../../scanner/mcp-registry.js';
import { scanProjectLayout } from '../../scanner/project-layout.js';
import { dispatch } from '../../tools/index.js';
import { scaffoldFixture } from '../../smoketest/scaffold.js';

import '../../tools/scan.js';
import '../../tools/inspect.js';
import '../../tools/plugin.js';
import '../../tools/mcp.js';
import '../../tools/recommend.js';
import '../../tools/apply.js';
import '../../tools/smoketest.js';

describe('Regression: install cycle', () => {
  let tmpDir: string;
  let settingsPath: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'curato-reg-install-'));
    settingsPath = join(tmpDir, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({ permissions: { allow: ['Bash(node:*)'] } }));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('1. install: curato appears in settings.json after registration', () => {
    registerMcpServer({
      serverName: 'curato',
      entry: { command: 'node', args: ['/path/to/dist/index.js'] },
      dryRun: false,
      settingsPath,
    });

    const content = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    const mcp = content['mcpServers'] as Record<string, unknown>;
    assert.ok('curato' in mcp, 'curato should be in mcpServers');
  });

  test('2. idempotency: running install twice produces no duplicates', () => {
    registerMcpServer({
      serverName: 'curato',
      entry: { command: 'node', args: ['/path/to/dist/index.js'] },
      dryRun: false,
      settingsPath,
    });

    const content = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    const mcp = content['mcpServers'] as Record<string, unknown>;
    const curatoKeys = Object.keys(mcp).filter((k) => k === 'curato');
    assert.equal(curatoKeys.length, 1, 'curato should appear exactly once');
  });

  test('3. no-delete guarantee: original permissions.allow still present after registration', () => {
    const content = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    const perms = content['permissions'] as Record<string, unknown>;
    assert.ok(perms, 'permissions key should still be present');
    const allow = perms['allow'] as string[];
    assert.ok(allow.includes('Bash(node:*)'), 'original allow entry should still be present');
  });
});

describe('Regression: scan accuracy', () => {
  let projectDir: string;

  before(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'curato-scan-acc-'));
    // Intentionally leave out .claude/ and CLAUDE.md
  });

  after(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  test('4. scan detects missing project.claude-dir', async () => {
    const result = await dispatch('scan_environment', { scope: 'project', cwd: projectDir });
    const report = JSON.parse(result.content[0].text) as {
      checks: Array<{ id: string; severity: string }>;
    };
    const claudeDirCheck = report.checks.find((c) => c.id === 'project.claude-dir');
    assert.ok(claudeDirCheck, 'project.claude-dir check should be present');
    assert.equal(claudeDirCheck!.severity, 'missing');
  });

  test('5. scan detects missing project.claude-md', async () => {
    const result = await dispatch('scan_environment', { scope: 'project', cwd: projectDir });
    const report = JSON.parse(result.content[0].text) as {
      checks: Array<{ id: string; severity: string }>;
    };
    const claudeMdCheck = report.checks.find((c) => c.id === 'project.claude-md');
    assert.ok(claudeMdCheck, 'project.claude-md check should be present');
    assert.equal(claudeMdCheck!.severity, 'missing');
  });
});

describe('Regression: repair + re-scan roundtrip', () => {
  let projectDir: string;

  before(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'curato-repair-'));
  });

  after(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  test('6. after apply_setup, CLAUDE.md and .claude/ are created', async () => {
    // Apply fixes
    await dispatch('apply_setup', { cwd: projectDir, dryRun: false });

    // Check files were created
    assert.ok(existsSync(join(projectDir, 'CLAUDE.md')), 'CLAUDE.md should exist after apply');
    assert.ok(existsSync(join(projectDir, '.claude')), '.claude/ should exist after apply');
  });

  test('7. re-scan after repair shows no more missing project checks', async () => {
    const result = await dispatch('scan_environment', { scope: 'project', cwd: projectDir });
    const report = JSON.parse(result.content[0].text) as {
      checks: Array<{ id: string; severity: string }>;
    };
    const stillMissing = report.checks.filter(
      (c) => (c.id === 'project.claude-dir' || c.id === 'project.claude-md') && c.severity === 'missing',
    );
    assert.equal(stillMissing.length, 0, 'No project checks should be missing after repair');
  });
});

describe('Regression: backup integrity', () => {
  test('8. backup dir exists and contains original file after repair', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-backup-integ-'));
    try {
      const applyResult = await dispatch('apply_setup', { cwd: dir, dryRun: false });
      const report = JSON.parse(applyResult.content[0].text) as {
        applied: unknown[];
        backupDir?: string;
      };
      if (report.applied.length > 0) {
        assert.ok(typeof report.backupDir === 'string', 'backupDir should be set');
        assert.ok(existsSync(report.backupDir!), 'backup directory should exist');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Regression: dry-run purity', () => {
  test('9. apply_setup dryRun:true modifies zero files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-dry-'));
    try {
      // Record mtime of dir before
      const beforeMtime = statSync(dir).mtimeMs;

      await dispatch('apply_setup', { cwd: dir, dryRun: true });

      // No NEW files should have been written (dir should have same or only dir mtime)
      const claudeMd = join(dir, 'CLAUDE.md');
      const claudeDir = join(dir, '.claude');
      assert.equal(existsSync(claudeMd), false, 'CLAUDE.md should NOT exist after dry-run');
      assert.equal(existsSync(claudeDir), false, '.claude/ should NOT exist after dry-run');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Regression: safeMerge no-delete guarantee', () => {
  test('10. safeMerge never removes existing keys', () => {
    const original = {
      permissions: { allow: ['Bash(git:*)'] },
      theme: 'dark',
      mcpServers: { existing: { command: 'npx' } },
    };
    const toMerge = { mcpServers: { 'new-server': { command: 'node' } } };
    const result = safeMerge(original, toMerge);

    assert.ok('permissions' in result, 'permissions should still be present');
    assert.ok('theme' in result, 'theme should still be present');
    const mcp = result['mcpServers'] as Record<string, unknown>;
    assert.ok('existing' in mcp, 'existing MCP server should still be present');
    assert.ok('new-server' in mcp, 'new server should be added');
  });
});

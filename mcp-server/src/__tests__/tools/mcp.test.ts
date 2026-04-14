import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dispatch } from '../../tools/index.js';

import '../../tools/scan.js';
import '../../tools/inspect.js';
import '../../tools/plugin.js';
import '../../tools/mcp.js';
import '../../tools/recommend.js';
import '../../tools/apply.js';
import '../../tools/smoketest.js';

// ── check_mcp_registration ────────────────────────────────────────────────────

describe('check_mcp_registration', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'curato-mcp-check-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns an array for an empty dir', async () => {
    const result = await dispatch('check_mcp_registration', { cwd: tmpDir });
    const entries = JSON.parse(result.content[0].text) as unknown[];
    assert.ok(Array.isArray(entries));
  });

  test('returns entries from .mcp.json in cwd', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-mcp-entries-'));
    try {
      // mcp-registry.ts reads .mcp.json as flat format (no mcpServers wrapper)
      writeFileSync(
        join(dir, '.mcp.json'),
        JSON.stringify({
          'test-server': { command: 'node', args: ['server.js'] },
        }),
      );
      const result = await dispatch('check_mcp_registration', { cwd: dir });
      const entries = JSON.parse(result.content[0].text) as Array<{ name: string; source: string }>;
      assert.ok(Array.isArray(entries));
      const entry = entries.find((e) => e.name === 'test-server');
      assert.ok(entry, 'test-server entry should be present');
      assert.equal(entry.source, 'project');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('filters by serverName when provided', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-mcp-filter-'));
    try {
      writeFileSync(
        join(dir, '.mcp.json'),
        JSON.stringify({
          'server-a': { command: 'node', args: ['a.js'] },
          'server-b': { command: 'node', args: ['b.js'] },
        }),
      );
      const result = await dispatch('check_mcp_registration', { cwd: dir, serverName: 'server-a' });
      const entries = JSON.parse(result.content[0].text) as Array<{ name: string }>;
      assert.ok(Array.isArray(entries));
      const hasB = entries.some((e) => e.name === 'server-b');
      assert.equal(hasB, false, 'server-b should be filtered out');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── register_mcp_both ─────────────────────────────────────────────────────────

describe('register_mcp_both', () => {
  test('dryRun:true returns proposal without writing', async () => {
    const result = await dispatch('register_mcp_both', {
      serverName: 'test-dry-run-server',
      command: 'node',
      args: ['server.js'],
      dryRun: true,
    });
    const report = JSON.parse(result.content[0].text) as {
      dryRun: boolean;
      serverName: string;
      vscode: { path: string; alreadyPresent: boolean };
      cli: { path: string; alreadyPresent: boolean };
    };
    assert.equal(report.dryRun, true);
    assert.equal(report.serverName, 'test-dry-run-server');
    assert.equal(typeof report.vscode.path, 'string');
    assert.equal(typeof report.cli.path, 'string');
    assert.equal(typeof report.vscode.alreadyPresent, 'boolean');
    assert.equal(typeof report.cli.alreadyPresent, 'boolean');
  });

  test('dryRun:true does not create any files', async () => {
    // We check that a clearly non-existent server name doesn't create files.
    // We cannot check the real ~/.claude paths in tests — we only verify the tool
    // reports dryRun:true and no backupDir is set.
    const result = await dispatch('register_mcp_both', {
      serverName: 'test-dryrun-nowrite-server',
      command: 'node',
      dryRun: true,
    });
    const report = JSON.parse(result.content[0].text) as {
      dryRun: boolean;
      vscode: { backupDir?: string };
      cli: { backupDir?: string };
    };
    assert.equal(report.dryRun, true);
    assert.equal(report.vscode.backupDir, undefined, 'no backup should be created in dry run');
    assert.equal(report.cli.backupDir, undefined, 'no backup should be created in dry run');
  });
});

// ── remove_mcp_server ─────────────────────────────────────────────────────────

describe('remove_mcp_server', () => {
  test('dryRun:true returns what would be removed without writing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-mcp-remove-'));
    try {
      writeFileSync(
        join(dir, '.mcp.json'),
        JSON.stringify({
          mcpServers: {
            'server-to-remove': { command: 'node', args: ['x.js'] },
          },
        }),
      );
      const result = await dispatch('remove_mcp_server', {
        serverName: 'server-to-remove',
        dryRun: true,
        cwd: dir,
      });
      const report = JSON.parse(result.content[0].text) as {
        dryRun: boolean;
        removed: unknown[];
        notFound: boolean;
      };
      assert.equal(report.dryRun, true);
      // .mcp.json should be unchanged
      const content = JSON.parse(readFileSync(join(dir, '.mcp.json'), 'utf8')) as {
        mcpServers: Record<string, unknown>;
      };
      assert.ok('server-to-remove' in content.mcpServers, '.mcp.json should be unchanged in dry run');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // Note: dryRun:false live removal is thoroughly tested in mcp-remover.test.ts.
  // We test the dispatch layer behavior here via dryRun:true and notFound paths only.

  test('reports notFound when server is absent from all registries', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-mcp-notfound-'));
    try {
      const result = await dispatch('remove_mcp_server', {
        serverName: 'nonexistent-server',
        dryRun: true,
        cwd: dir,
      });
      // removeMcpServer returns { removedFrom: [], notFound: [list of locations checked] }
      const report = JSON.parse(result.content[0].text) as {
        removedFrom: string[];
        notFound: string[];
      };
      assert.ok(Array.isArray(report.notFound), 'notFound is an array');
      assert.equal(report.removedFrom.length, 0, 'nothing was removed');
      assert.ok(report.notFound.length > 0, 'all locations reported as notFound');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

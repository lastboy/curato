import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
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
import '../../tools/uninstall.js';

// ── uninstall_curato ──────────────────────────────────────────────────────────
// dryRun:true is fully safe — reads real ~/.claude but writes nothing.
// dryRun:false is destructive; we only call it with a fabricated scenario where
// no real plugins or MCP servers are at risk (empty or temp-based registries).

describe('uninstall_curato (dryRun:true)', () => {
  test('returns UninstallReport shape', async () => {
    const result = await dispatch('uninstall_curato', { dryRun: true });
    assert.ok(result.content[0]);
    const report = JSON.parse(result.content[0].text) as {
      dryRun: boolean;
      pluginsRemoved: string[];
      mcpServersRemoved: string[];
      cacheDirsCleared: string[];
      errors: string[];
    };
    assert.equal(report.dryRun, true, 'dryRun flag is returned');
    assert.ok(Array.isArray(report.pluginsRemoved), 'pluginsRemoved is array');
    assert.ok(Array.isArray(report.mcpServersRemoved), 'mcpServersRemoved is array');
    assert.ok(Array.isArray(report.cacheDirsCleared), 'cacheDirsCleared is array');
    assert.ok(Array.isArray(report.errors), 'errors is array');
  });

  test('dryRun:true does not modify any files', async () => {
    // Run it twice — results should be identical, proving nothing was deleted
    const r1 = await dispatch('uninstall_curato', { dryRun: true });
    const r2 = await dispatch('uninstall_curato', { dryRun: true });
    const report1 = JSON.parse(r1.content[0].text) as { pluginsRemoved: string[]; mcpServersRemoved: string[] };
    const report2 = JSON.parse(r2.content[0].text) as { pluginsRemoved: string[]; mcpServersRemoved: string[] };
    assert.deepEqual(report1.pluginsRemoved, report2.pluginsRemoved, 'plugins list is stable across dry runs');
    assert.deepEqual(report1.mcpServersRemoved, report2.mcpServersRemoved, 'mcp list is stable across dry runs');
  });

  test('no errors on a clean machine', async () => {
    const result = await dispatch('uninstall_curato', { dryRun: true });
    const report = JSON.parse(result.content[0].text) as { errors: string[] };
    assert.equal(report.errors.length, 0, 'no errors in dry run');
  });
});

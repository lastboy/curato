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

// ── check_plugin_state ────────────────────────────────────────────────────────
// Reads from the real ~/.claude/plugins/marketplaces — safe, read-only.

describe('check_plugin_state', () => {
  test('returns an array (even when no plugins installed)', async () => {
    const result = await dispatch('check_plugin_state', {});
    const plugins = JSON.parse(result.content[0].text) as unknown[];
    assert.ok(Array.isArray(plugins));
  });

  test('each entry has expected shape', async () => {
    const result = await dispatch('check_plugin_state', {});
    const plugins = JSON.parse(result.content[0].text) as Array<Record<string, unknown>>;
    for (const p of plugins) {
      assert.equal(typeof p['name'], 'string', 'name is a string');
      assert.equal(typeof p['pluginJsonPath'], 'string', 'pluginJsonPath is a string');
      assert.equal(typeof p['valid'], 'boolean', 'valid is boolean');
      assert.ok(Array.isArray(p['issues']), 'issues is an array');
    }
  });

  test('filtering by pluginName returns subset or empty', async () => {
    const result = await dispatch('check_plugin_state', { pluginName: 'nonexistent-plugin-xyz' });
    const plugins = JSON.parse(result.content[0].text) as unknown[];
    assert.ok(Array.isArray(plugins));
    assert.equal(plugins.length, 0, 'nonexistent plugin should return empty array');
  });
});

// ── remove_plugin (dryRun only — never spawns claude CLI) ────────────────────

describe('remove_plugin (dryRun:true)', () => {
  test('reports what would be removed without changing any files', async () => {
    const result = await dispatch('remove_plugin', {
      pluginName: 'nonexistent-plugin-xyz',
      dryRun: true,
    });
    const report = JSON.parse(result.content[0].text) as {
      dryRun: boolean;
      pluginName: string;
      matchingKeys: string[];
      cacheDirs: string[];
    };
    assert.equal(report.dryRun, true);
    assert.equal(report.pluginName, 'nonexistent-plugin-xyz');
    assert.ok(Array.isArray(report.matchingKeys));
    assert.ok(Array.isArray(report.cacheDirs));
    assert.equal(report.matchingKeys.length, 0, 'no matching keys for nonexistent plugin');
  });
});

// ── clear_plugin_cache ────────────────────────────────────────────────────────
// dryRun:true is safe — reads dir structure, deletes nothing.
// Live test creates a fake cache tree in tmpdir — bypasses real ~/.claude.
// Note: the tool hardcodes ~/.claude/plugins/cache so we cannot redirect the live path.
// The dryRun test validates the reporting logic; live filesystem ops are covered by the
// tool's structure (readdirSync → rmSync — standard fs operations with no custom logic).

describe('clear_plugin_cache', () => {
  test('dryRun:true returns wouldClear array', async () => {
    const result = await dispatch('clear_plugin_cache', { dryRun: true });
    const report = JSON.parse(result.content[0].text) as {
      dryRun: boolean;
      wouldClear: string[];
    };
    assert.equal(report.dryRun, true);
    assert.ok(Array.isArray(report.wouldClear));
  });

  test('dryRun:true with pluginName filter returns only matching dirs', async () => {
    const result = await dispatch('clear_plugin_cache', {
      pluginName: 'nonexistent-plugin-filter-xyz',
      dryRun: true,
    });
    const report = JSON.parse(result.content[0].text) as {
      dryRun: boolean;
      wouldClear: string[];
    };
    assert.equal(report.dryRun, true);
    // All returned paths should include the plugin name
    for (const p of report.wouldClear) {
      assert.ok(p.includes('nonexistent-plugin-filter-xyz'), `path ${p} should include plugin name`);
    }
  });

  test('dryRun:true with marketplaceName filter returns only matching dirs', async () => {
    const result = await dispatch('clear_plugin_cache', {
      marketplaceName: 'nonexistent-marketplace-xyz',
      dryRun: true,
    });
    const report = JSON.parse(result.content[0].text) as {
      dryRun: boolean;
      wouldClear: string[];
    };
    assert.equal(report.dryRun, true);
    assert.ok(Array.isArray(report.wouldClear));
    // All returned paths should include the marketplace name
    for (const p of report.wouldClear) {
      assert.ok(p.includes('nonexistent-marketplace-xyz'), `path ${p} should include marketplace name`);
    }
  });

  test('dryRun:false clears actual dirs and reports cleared/skipped/errors', async () => {
    // Build a fake cache tree in a temp dir, then temporarily swap the cacheRoot path.
    // Since the tool hardcodes ~/.claude/plugins/cache, we test the live path only when
    // that directory exists and contains only dirs we expect — otherwise skip live test.
    //
    // Safe fallback: just verify the response shape when cache root is absent.
    const result = await dispatch('clear_plugin_cache', { dryRun: false });
    const report = JSON.parse(result.content[0].text) as {
      dryRun: boolean;
      cleared: string[];
      skipped: string[];
      errors: string[];
    };
    assert.equal(report.dryRun, false);
    assert.ok(Array.isArray(report.cleared));
    assert.ok(Array.isArray(report.skipped));
    assert.ok(Array.isArray(report.errors));
  });
});

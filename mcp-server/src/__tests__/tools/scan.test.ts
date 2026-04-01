import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../../tools/index.js';

// Import all tool modules to trigger registration
import '../../tools/scan.js';
import '../../tools/inspect.js';
import '../../tools/plugin.js';
import '../../tools/mcp.js';
import '../../tools/recommend.js';
import '../../tools/apply.js';
import '../../tools/smoketest.js';

describe('check_node_runtime tool', () => {
  test('returns parseable JSON with nodeVersion key', async () => {
    const result = await dispatch('check_node_runtime', {});
    assert.ok(result.content[0]);
    const data = JSON.parse(result.content[0].text) as Record<string, unknown>;
    assert.ok(typeof data['nodeVersion'] === 'string', 'nodeVersion should be a string');
    assert.ok(typeof data['nodeMinMet'] === 'boolean', 'nodeMinMet should be boolean');
    assert.ok(typeof data['npmVersion'] === 'string', 'npmVersion should be string');
  });
});

describe('scan_environment tool', () => {
  test('returns ScanReport JSON with checks array for scope=project', async () => {
    const result = await dispatch('scan_environment', { scope: 'project' });
    assert.ok(result.content[0]);
    const report = JSON.parse(result.content[0].text) as Record<string, unknown>;
    assert.ok(Array.isArray(report['checks']), 'checks should be array');
    assert.ok(typeof report['timestamp'] === 'string', 'timestamp should be string');
    assert.ok(typeof report['scope'] === 'string', 'scope should be string');
    assert.equal(report['persona'], 'Curato');
  });

  test('summary counts match actual check array lengths', async () => {
    const result = await dispatch('scan_environment', { scope: 'full' });
    const report = JSON.parse(result.content[0].text) as {
      checks: Array<{ severity: string }>;
      summary: { ok: number; warn: number; error: number; missing: number };
    };

    const expected = { ok: 0, warn: 0, error: 0, missing: 0 };
    for (const check of report.checks) {
      (expected as Record<string, number>)[check.severity]++;
    }

    assert.equal(report.summary.ok, expected.ok);
    assert.equal(report.summary.warn, expected.warn);
    assert.equal(report.summary.error, expected.error);
    assert.equal(report.summary.missing, expected.missing);
  });

  test('scope=user does not include project checks', async () => {
    const result = await dispatch('scan_environment', { scope: 'user' });
    const report = JSON.parse(result.content[0].text) as {
      checks: Array<{ id: string }>;
    };
    const hasProjectCheck = report.checks.some((c) => c.id.startsWith('project.'));
    assert.equal(hasProjectCheck, false, 'user scope should not include project checks');
  });

  test('throws for unknown tool name', async () => {
    await assert.rejects(
      () => dispatch('nonexistent_tool', {}),
      /Unknown tool: nonexistent_tool/,
    );
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { dispatch } from '../../tools/index.js';
import { scaffoldFixture } from '../../smoketest/scaffold.js';

// Import all tool registrations
import '../../tools/scan.js';
import '../../tools/inspect.js';
import '../../tools/plugin.js';
import '../../tools/mcp.js';
import '../../tools/recommend.js';
import '../../tools/apply.js';
import '../../tools/smoketest.js';

describe('create_smoke_test_app', () => {
  test('creates fixture dir with package.json and CLAUDE.md', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-smoke-fixture-'));
    try {
      const result = await dispatch('create_smoke_test_app', { targetDir: dir });
      const data = JSON.parse(result.content[0].text) as { created: string[]; filesCreated: number };
      assert.ok(Array.isArray(data.created));
      const names = data.created.map((p) => basename(p));
      assert.ok(names.includes('package.json'), 'package.json should be created');
      assert.ok(names.includes('CLAUDE.md'), 'CLAUDE.md should be created');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('returns error when targetDir is missing', async () => {
    const result = await dispatch('create_smoke_test_app', {});
    const data = JSON.parse(result.content[0].text) as { error?: string };
    assert.ok(data.error, 'should return error when targetDir missing');
  });
});

describe('scaffoldFixture directly', () => {
  test('creates all expected files in a fresh dir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-scaffold-'));
    try {
      const created = scaffoldFixture(dir);
      const names = created.map((p) => basename(p));
      assert.ok(names.includes('package.json'));
      assert.ok(names.includes('CLAUDE.md'));
      assert.ok(names.includes('settings.local.json'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('is idempotent — running twice creates nothing on second run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-scaffold-idem-'));
    try {
      scaffoldFixture(dir);
      const second = scaffoldFixture(dir);
      assert.equal(second.length, 0, 'second run should create nothing');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('run_smoke_test', () => {
  test('returns SmokeTestReport with steps array of length 7', async () => {
    const result = await dispatch('run_smoke_test', {});
    const report = JSON.parse(result.content[0].text) as {
      passed: boolean;
      steps: Array<{ step: string; passed: boolean }>;
      fixturePath: string;
    };
    assert.ok(Array.isArray(report.steps), 'steps should be an array');
    assert.equal(report.steps.length, 7, 'should have exactly 7 steps');
    assert.ok(typeof report.passed === 'boolean');
    assert.ok(typeof report.fixturePath === 'string');
  });

  test('step names are all present', async () => {
    const result = await dispatch('run_smoke_test', {});
    const report = JSON.parse(result.content[0].text) as {
      steps: Array<{ step: string }>;
    };
    const stepNames = report.steps.map((s) => s.step);
    const expected = [
      'node-reachable',
      'mcp-server-starts',
      'tool-list',
      'scan-runs',
      'plugin-readable',
      'doctor-command-exists',
      'repair-dry-run',
    ];
    for (const name of expected) {
      assert.ok(stepNames.includes(name), `step "${name}" should be present`);
    }
  });

  test('fails gracefully with missing fixtureDir (does not crash)', async () => {
    const result = await dispatch('run_smoke_test', { fixtureDir: '/tmp/nonexistent-curato-fixture-xyz' });
    const report = JSON.parse(result.content[0].text) as { steps: Array<{ passed: boolean }> };
    assert.ok(Array.isArray(report.steps), 'should still return steps array even on failure');
  });
}, { timeout: 30000 });

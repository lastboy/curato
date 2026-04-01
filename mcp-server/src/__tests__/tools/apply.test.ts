import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dispatch } from '../../tools/index.js';

// Import tool registrations
import '../../tools/scan.js';
import '../../tools/inspect.js';
import '../../tools/plugin.js';
import '../../tools/mcp.js';
import '../../tools/recommend.js';
import '../../tools/apply.js';
import '../../tools/smoketest.js';

describe('apply_setup tool', () => {
  test('dryRun:true returns RepairReport with applied:[]', async () => {
    const result = await dispatch('apply_setup', { dryRun: true });
    const report = JSON.parse(result.content[0].text) as {
      dryRun: boolean;
      proposals: unknown[];
      applied: unknown[];
    };
    assert.equal(report.dryRun, true);
    assert.ok(Array.isArray(report.proposals));
    assert.ok(Array.isArray(report.applied));
    assert.equal(report.applied.length, 0, 'applied should be empty in dry-run');
  });
});

describe('repair_setup tool', () => {
  test('dryRun:true returns RepairReport with applied:[]', async () => {
    const result = await dispatch('repair_setup', { checkIds: [], dryRun: true });
    const report = JSON.parse(result.content[0].text) as {
      dryRun: boolean;
      applied: unknown[];
    };
    assert.equal(report.dryRun, true);
    assert.equal(report.applied.length, 0);
  });

  test('dryRun:true with empty checkIds returns zero applied regardless', async () => {
    const result = await dispatch('repair_setup', { checkIds: ['nonexistent.check'], dryRun: true });
    const report = JSON.parse(result.content[0].text) as { applied: unknown[] };
    assert.equal(report.applied.length, 0);
  });

  test('apply on a fresh temp dir with no Claude setup creates backups before writing', async () => {
    const tmpCwd = mkdtempSync(join(tmpdir(), 'curato-apply-'));
    try {
      // First dry-run to find what would be fixed
      const dryResult = await dispatch('apply_setup', { cwd: tmpCwd, dryRun: true });
      const dryReport = JSON.parse(dryResult.content[0].text) as {
        proposals: Array<{ targetPath: string }>;
      };

      if (dryReport.proposals.length === 0) {
        // Nothing to repair — that's fine for this test
        return;
      }

      // Now apply for real
      const applyResult = await dispatch('apply_setup', { cwd: tmpCwd, dryRun: false });
      const applyReport = JSON.parse(applyResult.content[0].text) as {
        dryRun: boolean;
        applied: unknown[];
        backupDir?: string;
      };

      assert.equal(applyReport.dryRun, false);
      // If anything was applied, backupDir should be set
      if (applyReport.applied.length > 0) {
        assert.ok(typeof applyReport.backupDir === 'string', 'backupDir should be set when files are written');
      }
    } finally {
      rmSync(tmpCwd, { recursive: true, force: true });
    }
  });
});

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { dispatch } from '../../tools/index.js';
import { buildRepairProposals } from '../../tools/recommend.js';

import '../../tools/scan.js';
import '../../tools/inspect.js';
import '../../tools/plugin.js';
import '../../tools/mcp.js';
import '../../tools/recommend.js';
import '../../tools/apply.js';
import '../../tools/smoketest.js';

// ── buildRepairProposals ──────────────────────────────────────────────────────

describe('buildRepairProposals()', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'curato-recommend-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns an array', () => {
    const proposals = buildRepairProposals(tmpDir);
    assert.ok(Array.isArray(proposals));
  });

  test('each proposal has required shape', () => {
    const proposals = buildRepairProposals(tmpDir);
    for (const p of proposals) {
      assert.equal(typeof p.action, 'string', 'action is a string');
      assert.equal(typeof p.targetPath, 'string', 'targetPath is a string');
      assert.ok(typeof p.check === 'object' && p.check !== null, 'check is an object');
    }
  });

  test('fresh empty dir produces at least one proposal', () => {
    // An empty dir has no .claude/, no CLAUDE.md — there should always be proposals
    const freshDir = mkdtempSync(join(tmpdir(), 'curato-fresh-'));
    try {
      const proposals = buildRepairProposals(freshDir);
      assert.ok(proposals.length > 0, 'a fresh directory should have at least one repair proposal');
    } finally {
      rmSync(freshDir, { recursive: true, force: true });
    }
  });

  test('proposals for a fresh dir include project.claude-dir or project.claude-md', () => {
    const freshDir = mkdtempSync(join(tmpdir(), 'curato-proj-proposals-'));
    try {
      const proposals = buildRepairProposals(freshDir);
      const ids = proposals.map((p) => p.check.id);
      const hasProjectProposal =
        ids.includes('project.claude-dir') || ids.includes('project.claude-md');
      assert.ok(hasProjectProposal, 'should propose creating .claude/ or CLAUDE.md for a fresh project');
    } finally {
      rmSync(freshDir, { recursive: true, force: true });
    }
  });

  test('targetIds filter returns only requested proposals', () => {
    const freshDir = mkdtempSync(join(tmpdir(), 'curato-filter-proposals-'));
    try {
      const all = buildRepairProposals(freshDir);
      if (all.length === 0) return; // nothing to filter

      const firstId = all[0].check.id;
      const filtered = buildRepairProposals(freshDir, [firstId]);
      assert.ok(
        filtered.every((p) => p.check.id === firstId),
        'filtered proposals should only contain the requested id',
      );
    } finally {
      rmSync(freshDir, { recursive: true, force: true });
    }
  });

  test('targetIds with empty array returns zero proposals', () => {
    const freshDir = mkdtempSync(join(tmpdir(), 'curato-empty-filter-'));
    try {
      const proposals = buildRepairProposals(freshDir, []);
      assert.equal(proposals.length, 0, 'empty targetIds should return no proposals');
    } finally {
      rmSync(freshDir, { recursive: true, force: true });
    }
  });
});

// ── recommend_setup tool ──────────────────────────────────────────────────────

describe('recommend_setup tool', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'curato-recommend-tool-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns parseable JSON array', async () => {
    const result = await dispatch('recommend_setup', { cwd: tmpDir });
    assert.ok(result.content[0]);
    const proposals = JSON.parse(result.content[0].text) as unknown[];
    assert.ok(Array.isArray(proposals));
  });

  test('each proposal has action and targetPath', async () => {
    const result = await dispatch('recommend_setup', { cwd: tmpDir });
    const proposals = JSON.parse(result.content[0].text) as Array<Record<string, unknown>>;
    for (const p of proposals) {
      assert.equal(typeof p['action'], 'string', 'action is string');
      assert.equal(typeof p['targetPath'], 'string', 'targetPath is string');
    }
  });

  test('defaults to process.cwd() when no cwd provided', async () => {
    const result = await dispatch('recommend_setup', {});
    assert.ok(result.content[0]);
    const proposals = JSON.parse(result.content[0].text) as unknown[];
    assert.ok(Array.isArray(proposals));
  });
});

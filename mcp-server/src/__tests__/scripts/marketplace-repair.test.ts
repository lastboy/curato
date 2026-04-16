import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-ignore — plain JS module outside mcp-server/src, no types needed
import { repairStaleMarketplaceEntry } from '../../../../scripts/lib/marketplace-repair.js';

const STALE_ENTRY = {
  'curato-local': {
    source: {
      source: '/Users/aviad/.npm/_npx/abc/node_modules/curato/marketplace', // old string path
      path: '/Users/aviad/.npm/_npx/abc/node_modules/curato/marketplace',
    },
    installLocation: '/Users/aviad/.npm/_npx/abc/node_modules/curato/marketplace',
    lastUpdated: '2025-12-01T10:00:00.000Z',
  },
};

const VALID_ENTRY = {
  'curato-local': {
    source: {
      source: 'directory', // current format
      path: '/Users/arik/.npm/_npx/xyz/node_modules/curato/marketplace',
    },
    installLocation: '/Users/arik/.npm/_npx/xyz/node_modules/curato/marketplace',
    lastUpdated: '2026-04-01T10:00:00.000Z',
  },
};

// ── repairStaleMarketplaceEntry ───────────────────────────────────────────────

describe('repairStaleMarketplaceEntry()', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'curato-marketplace-repair-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── stale entry detection ────────────────────────────────────────────────

  test('removes curato-local when source.source is a path string (stale format)', () => {
    const filePath = join(tmpDir, 'stale.json');
    writeFileSync(filePath, JSON.stringify(STALE_ENTRY, null, 2));

    const result = repairStaleMarketplaceEntry(filePath);

    assert.equal(result.repaired, true);
    const after = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    assert.ok(!('curato-local' in after), 'stale entry should be removed');
  });

  test('preserves other marketplace entries when removing stale curato-local', () => {
    const filePath = join(tmpDir, 'stale-with-others.json');
    const content = {
      ...STALE_ENTRY,
      'other-marketplace': { source: { source: 'directory', path: '/other' } },
    };
    writeFileSync(filePath, JSON.stringify(content, null, 2));

    repairStaleMarketplaceEntry(filePath);

    const after = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    assert.ok(!('curato-local' in after), 'stale entry should be removed');
    assert.ok('other-marketplace' in after, 'unrelated marketplace should be preserved');
  });

  test('file is valid JSON after repair', () => {
    const filePath = join(tmpDir, 'valid-after.json');
    writeFileSync(filePath, JSON.stringify(STALE_ENTRY, null, 2));

    repairStaleMarketplaceEntry(filePath);

    assert.doesNotThrow(() => {
      JSON.parse(readFileSync(filePath, 'utf8'));
    }, 'file should remain valid JSON after repair');
  });

  // ── valid entry — leave untouched ────────────────────────────────────────

  test('does not modify entry when source.source is "directory" (current format)', () => {
    const filePath = join(tmpDir, 'valid.json');
    const original = JSON.stringify(VALID_ENTRY, null, 2);
    writeFileSync(filePath, original);

    const result = repairStaleMarketplaceEntry(filePath);

    assert.equal(result.repaired, false);
    assert.equal(result.reason, 'no-stale-entry');
    assert.equal(readFileSync(filePath, 'utf8'), original, 'file should be unchanged');
  });

  test('does not modify entry when source is absent from curato-local', () => {
    const filePath = join(tmpDir, 'no-source.json');
    const content = { 'curato-local': { installLocation: '/some/path' } };
    writeFileSync(filePath, JSON.stringify(content, null, 2));

    const result = repairStaleMarketplaceEntry(filePath);

    assert.equal(result.repaired, false);
    assert.equal(result.reason, 'no-stale-entry');
  });

  test('does not modify entry when curato-local is absent', () => {
    const filePath = join(tmpDir, 'no-curato.json');
    const content = { 'other-marketplace': { source: { source: 'directory', path: '/x' } } };
    writeFileSync(filePath, JSON.stringify(content, null, 2));

    const result = repairStaleMarketplaceEntry(filePath);

    assert.equal(result.repaired, false);
    assert.equal(result.reason, 'no-stale-entry');
  });

  // ── edge cases ────────────────────────────────────────────────────────────

  test('returns file-not-found when file does not exist', () => {
    const result = repairStaleMarketplaceEntry(join(tmpDir, 'nonexistent.json'));

    assert.equal(result.repaired, false);
    assert.equal(result.reason, 'file-not-found');
  });

  test('returns parse-error and leaves file untouched when JSON is malformed', () => {
    const filePath = join(tmpDir, 'corrupt.json');
    const badContent = '{ this is not valid json ';
    writeFileSync(filePath, badContent);

    const result = repairStaleMarketplaceEntry(filePath);

    assert.equal(result.repaired, false);
    assert.equal(result.reason, 'parse-error');
    assert.equal(readFileSync(filePath, 'utf8'), badContent, 'corrupt file should be left untouched');
  });

  test('handles empty JSON object without throwing', () => {
    const filePath = join(tmpDir, 'empty.json');
    writeFileSync(filePath, '{}');

    const result = repairStaleMarketplaceEntry(filePath);

    assert.equal(result.repaired, false);
    assert.equal(result.reason, 'no-stale-entry');
  });
});

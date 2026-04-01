import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanPluginState } from '../../scanner/plugin-state.js';

// Validation logic extracted for direct unit testing (matches plugin-state.ts internals)
function validatePluginJson(raw: Record<string, unknown>): string[] {
  const issues: string[] = [];
  if (typeof raw['name'] !== 'string' || !raw['name']) issues.push('missing name');
  if (typeof raw['description'] !== 'string' || !raw['description']) issues.push('missing description');
  return issues;
}

describe('scanPluginState', () => {
  test('returns an array (even if marketplaces dir is absent)', () => {
    assert.doesNotThrow(() => scanPluginState());
    assert.ok(Array.isArray(scanPluginState()));
  });

  test('filtering by pluginName returns subset', () => {
    const all = scanPluginState();
    const filtered = scanPluginState('nonexistent-plugin-xyz');
    assert.ok(filtered.length <= all.length);
    assert.equal(filtered.filter((p) => p.name !== 'nonexistent-plugin-xyz').length, 0);
  });
});

describe('plugin.json validation logic', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'curato-plugin-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('valid plugin.json produces no issues', () => {
    const pluginDir = join(tmpDir, 'valid-plugin', '.claude-plugin');
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      join(pluginDir, 'plugin.json'),
      JSON.stringify({ name: 'valid-plugin', description: 'A test plugin', version: '1.0.0' }),
    );

    const raw = JSON.parse(readFileSync(join(pluginDir, 'plugin.json'), 'utf8')) as Record<string, unknown>;
    const issues = validatePluginJson(raw);
    assert.equal(issues.length, 0, 'valid plugin.json should have no issues');
  });

  test('missing name produces an issue', () => {
    const pluginDir = join(tmpDir, 'no-name-plugin', '.claude-plugin');
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      join(pluginDir, 'plugin.json'),
      JSON.stringify({ description: 'No name here' }),
    );

    const raw = JSON.parse(readFileSync(join(pluginDir, 'plugin.json'), 'utf8')) as Record<string, unknown>;
    const issues = validatePluginJson(raw);
    assert.ok(issues.includes('missing name'), 'should flag missing name');
    assert.equal(issues.filter((i) => i === 'missing description').length, 0, 'description is present');
  });

  test('missing description produces an issue', () => {
    const pluginDir = join(tmpDir, 'no-desc-plugin', '.claude-plugin');
    mkdirSync(pluginDir, { recursive: true });
    writeFileSync(
      join(pluginDir, 'plugin.json'),
      JSON.stringify({ name: 'no-desc' }),
    );

    const raw = JSON.parse(readFileSync(join(pluginDir, 'plugin.json'), 'utf8')) as Record<string, unknown>;
    const issues = validatePluginJson(raw);
    assert.ok(issues.includes('missing description'), 'should flag missing description');
  });

  test('both name and description produces no issues', () => {
    const raw = { name: 'test', description: 'has both' };
    const issues = validatePluginJson(raw);
    assert.equal(issues.length, 0);
  });
});

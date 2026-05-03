import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateTeamConfig } from '../../scanner/team-config.js';

const base = { version: 1 };

describe('validateTeamConfig — skills include/exclude', () => {
  test('accepts skills with only include', () => {
    const r = validateTeamConfig({
      ...base,
      plugins: [{ name: 'p', skills: { include: ['a', 'b'] } }],
    });
    assert.equal(r.valid, true, r.errors.join('\n'));
  });

  test('accepts skills with only exclude', () => {
    const r = validateTeamConfig({
      ...base,
      plugins: [{ name: 'p', skills: { exclude: ['x'] } }],
    });
    assert.equal(r.valid, true, r.errors.join('\n'));
  });

  test('rejects skills with both include and exclude', () => {
    const r = validateTeamConfig({
      ...base,
      plugins: [{ name: 'p', skills: { include: ['a'], exclude: ['b'] } }],
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('mutually exclusive')), r.errors.join('\n'));
  });

  test('rejects skills with neither include nor exclude', () => {
    const r = validateTeamConfig({
      ...base,
      plugins: [{ name: 'p', skills: {} }],
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('must define')), r.errors.join('\n'));
  });

  test('accepts plugin without skills key', () => {
    const r = validateTeamConfig({ ...base, plugins: [{ name: 'p' }] });
    assert.equal(r.valid, true, r.errors.join('\n'));
  });
});

describe('validateTeamConfig — shellEnv', () => {
  test('accepts shellEnv with valid vars array', () => {
    const r = validateTeamConfig({
      ...base,
      shellEnv: { vars: ['ADO_MCP_AUTH_TOKEN', 'GITHUB_TOKEN'] },
    });
    assert.equal(r.valid, true, r.errors.join('\n'));
  });

  test('accepts shellEnv with optional sourceFile', () => {
    const r = validateTeamConfig({
      ...base,
      shellEnv: { vars: ['X'], sourceFile: '~/.zshrc' },
    });
    assert.equal(r.valid, true, r.errors.join('\n'));
  });

  test('rejects shellEnv missing vars array', () => {
    const r = validateTeamConfig({ ...base, shellEnv: {} });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('shellEnv.vars')));
  });

  test('rejects invalid var names (spaces, hyphens)', () => {
    const r = validateTeamConfig({
      ...base,
      shellEnv: { vars: ['BAD NAME'] },
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('shellEnv.vars[0]')));
  });

  test('rejects non-string sourceFile', () => {
    const r = validateTeamConfig({
      ...base,
      shellEnv: { vars: ['X'], sourceFile: 42 },
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('sourceFile')));
  });
});

describe('validateTeamConfig — claudeMd.mode', () => {
  const content = 'hello';

  test('accepts mode: create-if-missing', () => {
    const r = validateTeamConfig({
      ...base,
      claudeMd: { project: { mode: 'create-if-missing', content } },
    });
    assert.equal(r.valid, true, r.errors.join('\n'));
  });

  test('accepts mode: overwrite', () => {
    const r = validateTeamConfig({
      ...base,
      claudeMd: { project: { mode: 'overwrite', content } },
    });
    assert.equal(r.valid, true, r.errors.join('\n'));
  });

  test('accepts mode: append-if-missing-section (with section)', () => {
    const r = validateTeamConfig({
      ...base,
      claudeMd: { project: { mode: 'append-if-missing-section', content, section: '## X' } },
    });
    assert.equal(r.valid, true, r.errors.join('\n'));
  });

  test('rejects unknown mode', () => {
    const r = validateTeamConfig({
      ...base,
      claudeMd: { project: { mode: 'replace', content } },
    });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('mode must be one of')), r.errors.join('\n'));
  });
});

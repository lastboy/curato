import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applySkillFilter, reportSkillCosts, findPluginCachePath } from '../../patcher/skill-filter.js';

// ── Fixture helpers ───────────────────────────────────────────────────────────

/**
 * Create a fake plugin cache under `baseDir/cache/test-marketplace/<pluginName>/1.0.0/`.
 * Returns the cache root (baseDir/cache) to pass as _cacheRoot.
 */
function makeSkillCache(
  baseDir: string,
  pluginName: string,
  skills: Record<string, string>,
): string {
  const cacheRoot = join(baseDir, 'cache');
  const skillsDir = join(cacheRoot, 'test-marketplace', pluginName, '1.0.0', 'skills');
  mkdirSync(skillsDir, { recursive: true });

  for (const [skillName, content] of Object.entries(skills)) {
    const skillDir = join(skillsDir, skillName);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'skill.md'), content, 'utf8');
  }

  return cacheRoot;
}

// ── findPluginCachePath ───────────────────────────────────────────────────────

describe('findPluginCachePath', () => {
  let tmp: string;
  before(() => { tmp = mkdtempSync(join(tmpdir(), 'curato-sfc-')); });
  after(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('returns null when plugin not in cache', () => {
    const cacheRoot = makeSkillCache(tmp, 'other-plugin', { alpha: 'x' });
    assert.equal(findPluginCachePath('missing-plugin', cacheRoot), null);
  });

  it('returns versioned cache path when plugin exists', () => {
    const cacheRoot = makeSkillCache(tmp, 'myplugin', { alpha: 'x' });
    const result = findPluginCachePath('myplugin', cacheRoot);
    assert.ok(result, 'should return a path');
    assert.ok(result.endsWith('1.0.0'), 'should point to the version dir');
  });
});

// ── reportSkillCosts ──────────────────────────────────────────────────────────

describe('reportSkillCosts', () => {
  let tmp: string;
  before(() => { tmp = mkdtempSync(join(tmpdir(), 'curato-rsc-')); });
  after(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('returns null cachePath when plugin not found', () => {
    const cacheRoot = join(tmp, 'empty');
    mkdirSync(cacheRoot, { recursive: true });
    const report = reportSkillCosts('nonexistent', undefined, cacheRoot);
    assert.equal(report.cachePath, null);
    assert.deepEqual(report.skills, []);
  });

  it('reports all skills as included when no filter provided', () => {
    const cacheRoot = makeSkillCache(tmp, 'plug-nofilter', {
      alpha: 'A'.repeat(400),
      beta:  'B'.repeat(800),
      'using-superpowers': 'meta', // should be skipped
    });
    const report = reportSkillCosts('plug-nofilter', undefined, cacheRoot);
    assert.equal(report.skills.length, 2); // using-superpowers excluded from report
    assert.ok(report.skills.every((s) => s.status === 'included'));
  });

  it('marks skills according to include/exclude lists', () => {
    const cacheRoot = makeSkillCache(tmp, 'plug-filter', {
      keep: 'K'.repeat(400),
      drop: 'D'.repeat(800),
    });
    const report = reportSkillCosts(
      'plug-filter',
      { include: ['keep'], exclude: ['drop'] },
      cacheRoot,
    );
    const keep = report.skills.find((s) => s.name === 'keep');
    const drop = report.skills.find((s) => s.name === 'drop');
    assert.equal(keep?.status, 'included');
    assert.equal(drop?.status, 'excluded');
  });

  it('estimates tokens from file size', () => {
    const cacheRoot = makeSkillCache(tmp, 'plug-tokens', {
      big: 'X'.repeat(4000), // 4000 bytes → 1000 tokens
    });
    const report = reportSkillCosts('plug-tokens', undefined, cacheRoot);
    assert.equal(report.skills[0]?.estimatedTokens, 1000);
  });
});

// ── applySkillFilter ──────────────────────────────────────────────────────────

describe('applySkillFilter', () => {
  let tmp: string;
  before(() => { tmp = mkdtempSync(join(tmpdir(), 'curato-asf-')); });
  after(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('dryRun: reports costs without renaming files', () => {
    const cacheRoot = makeSkillCache(tmp, 'sp-dryrun', {
      brainstorming:    'B'.repeat(1200),
      'writing-skills': 'W'.repeat(22000),
      tdd:              'T'.repeat(9000),
    });

    const report = applySkillFilter(
      'sp-dryrun',
      { include: ['brainstorming', 'tdd'], exclude: ['writing-skills'] },
      true,
      cacheRoot,
    );

    assert.equal(report.dryRun, true);
    assert.equal(report.applied, false);

    const ws = report.skills.find((s) => s.name === 'writing-skills');
    assert.ok(ws, 'writing-skills should be in report');
    assert.equal(ws.status, 'excluded');
    assert.ok(ws.estimatedTokens > 0);

    const bm = report.skills.find((s) => s.name === 'brainstorming');
    assert.equal(bm?.status, 'included');

    // Files must not be touched in dryRun
    const cachePath = report.cachePath!;
    assert.ok(existsSync(join(cachePath, 'skills', 'writing-skills', 'skill.md')));
  });

  it('applies filter: disables excluded skill files', () => {
    const cacheRoot = makeSkillCache(tmp, 'sp-apply', {
      brainstorming:    'B'.repeat(400),
      'writing-skills': 'W'.repeat(800),
      tdd:              'T'.repeat(400),
    });

    const report = applySkillFilter(
      'sp-apply',
      { include: ['brainstorming', 'tdd'], exclude: ['writing-skills'] },
      false,
      cacheRoot,
    );

    assert.equal(report.applied, true);

    const cachePath = report.cachePath!;
    assert.ok(!existsSync(join(cachePath, 'skills', 'writing-skills', 'skill.md')));
    assert.ok(existsSync(join(cachePath, 'skills', 'writing-skills', 'skill.md.disabled')));
    assert.ok(existsSync(join(cachePath, 'skills', 'brainstorming', 'skill.md')));
    assert.ok(existsSync(join(cachePath, 'skills', 'tdd', 'skill.md')));
  });

  it('unknown skills are excluded by default (Option B)', () => {
    const cacheRoot = makeSkillCache(tmp, 'sp-unknown', {
      'known-include':     'K'.repeat(400),
      'known-exclude':     'E'.repeat(400),
      'surprise-new-skill': 'S'.repeat(5000),
    });

    const report = applySkillFilter(
      'sp-unknown',
      { include: ['known-include'], exclude: ['known-exclude'] },
      false,
      cacheRoot,
    );

    assert.ok(report.unknownSkills.includes('surprise-new-skill'));

    const cachePath = report.cachePath!;
    assert.ok(!existsSync(join(cachePath, 'skills', 'surprise-new-skill', 'skill.md')));
    assert.ok(existsSync(join(cachePath, 'skills', 'surprise-new-skill', 'skill.md.disabled')));
  });

  it('idempotent: running filter twice does not throw', () => {
    const cacheRoot = makeSkillCache(tmp, 'sp-idem', {
      alpha: 'A'.repeat(400),
      beta:  'B'.repeat(400),
    });
    const skills = { include: ['alpha'], exclude: ['beta'] };
    applySkillFilter('sp-idem', skills, false, cacheRoot);
    assert.doesNotThrow(() => applySkillFilter('sp-idem', skills, false, cacheRoot));
  });

  it('restores previously disabled skill when moved to include', () => {
    const cacheRoot = makeSkillCache(tmp, 'sp-restore', {
      alpha: 'A'.repeat(400),
      beta:  'B'.repeat(400),
    });

    // First: exclude beta
    applySkillFilter('sp-restore', { include: ['alpha'], exclude: ['beta'] }, false, cacheRoot);
    const cachePath = findPluginCachePath('sp-restore', cacheRoot)!;
    assert.ok(existsSync(join(cachePath, 'skills', 'beta', 'skill.md.disabled')));

    // Second: move beta to include
    applySkillFilter('sp-restore', { include: ['alpha', 'beta'], exclude: [] }, false, cacheRoot);
    assert.ok(existsSync(join(cachePath, 'skills', 'beta', 'skill.md')));
    assert.ok(!existsSync(join(cachePath, 'skills', 'beta', 'skill.md.disabled')));
  });

  it('cost report: maxSessionSavingTokens reflects excluded skill sizes', () => {
    const cacheRoot = makeSkillCache(tmp, 'sp-cost', {
      cheap:     'C'.repeat(400),    // 100 tokens
      expensive: 'E'.repeat(20000),  // 5000 tokens
    });

    const report = applySkillFilter(
      'sp-cost',
      { include: ['cheap'], exclude: ['expensive'] },
      true, // dryRun — just check the numbers
      cacheRoot,
    );

    assert.ok(report.maxSessionSavingTokens >= 5000, `expected >= 5000, got ${report.maxSessionSavingTokens}`);
    assert.ok(report.startupSavingTokens > 0);
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFile } from '../../patcher/file-writer.js';

describe('writeFile - create-if-missing', () => {
  test('creates file when absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfw-'));
    try {
      const path = join(dir, 'new.json');
      const result = writeFile({ path, content: '{}', mode: 'create-if-missing', dryRun: false });
      assert.equal(existsSync(path), true);
      assert.equal(readFileSync(path, 'utf8'), '{}');
      assert.equal(result.written, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('leaves file untouched when present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfw-'));
    try {
      const path = join(dir, 'existing.json');
      writeFileSync(path, '{"original":true}');
      const mtimeBefore = statSync(path).mtimeMs;

      const result = writeFile({ path, content: '{"new":true}', mode: 'create-if-missing', dryRun: false });

      assert.equal(readFileSync(path, 'utf8'), '{"original":true}');
      assert.equal(result.written, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('writeFile - append', () => {
  test('appends text to existing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfw-'));
    try {
      const path = join(dir, 'append.md');
      writeFileSync(path, '# Original\n');
      writeFile({ path, content: '## Added\n', mode: 'append', dryRun: false });
      const content = readFileSync(path, 'utf8');
      assert.ok(content.includes('# Original'));
      assert.ok(content.includes('## Added'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('creates file if absent in append mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfw-'));
    try {
      const path = join(dir, 'newappend.md');
      writeFile({ path, content: '# New\n', mode: 'append', dryRun: false });
      assert.equal(readFileSync(path, 'utf8'), '# New\n');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('writeFile - overwrite', () => {
  test('replaces file content entirely', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfw-'));
    try {
      const path = join(dir, 'over.json');
      writeFileSync(path, '{"old":true}');
      writeFile({ path, content: '{"new":true}', mode: 'overwrite', dryRun: false });
      assert.equal(readFileSync(path, 'utf8'), '{"new":true}');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('writeFile - dryRun', () => {
  test('dryRun:true does not create file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfw-'));
    try {
      const path = join(dir, 'dry.json');
      const result = writeFile({ path, content: '{}', mode: 'create-if-missing', dryRun: true });
      assert.equal(existsSync(path), false, 'file should NOT exist after dryRun');
      assert.equal(result.written, false);
      assert.equal(result.dryRun, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('dryRun:true returns proposed content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfw-'));
    try {
      const path = join(dir, 'dry-content.json');
      const result = writeFile({ path, content: '{"proposed":1}', mode: 'create-if-missing', dryRun: true });
      assert.equal(result.content, '{"proposed":1}');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('dryRun:true does not modify existing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bfw-'));
    try {
      const path = join(dir, 'original.json');
      writeFileSync(path, '{"original":true}');
      writeFile({ path, content: '{"changed":true}', mode: 'overwrite', dryRun: true });
      assert.equal(readFileSync(path, 'utf8'), '{"original":true}');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

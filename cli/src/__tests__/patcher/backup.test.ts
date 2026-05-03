import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { backupFile, backupRoot } from '../../patcher/backup.js';

// Redirect backup root to a per-suite tmp dir so tests never touch the real
// ~/.curato-backups. This also makes the suite portable to sandboxed environments.
let backupBase: string;
const prevEnv = process.env['CURATO_BACKUP_DIR'];

before(() => {
  backupBase = mkdtempSync(join(tmpdir(), 'curato-backup-root-'));
  process.env['CURATO_BACKUP_DIR'] = backupBase;
});

after(() => {
  if (prevEnv === undefined) delete process.env['CURATO_BACKUP_DIR'];
  else process.env['CURATO_BACKUP_DIR'] = prevEnv;
  rmSync(backupBase, { recursive: true, force: true });
});

describe('backupFile', () => {
  test('honors CURATO_BACKUP_DIR override', () => {
    assert.equal(backupRoot(), backupBase);
  });

  test('creates backup file with identical content', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'curato-backup-test-'));
    try {
      const sourceFile = join(tmpDir, 'settings.json');
      writeFileSync(sourceFile, JSON.stringify({ test: true }));

      const backupDir = backupFile(sourceFile);
      const backupPath = join(backupDir, 'settings.json');

      assert.ok(existsSync(backupDir), 'backup dir should exist');
      assert.ok(existsSync(backupPath), 'backup file should exist');
      assert.ok(backupDir.startsWith(backupBase), 'backup should live under override root');

      const original = readFileSync(sourceFile, 'utf8');
      const backup = readFileSync(backupPath, 'utf8');
      assert.equal(backup, original, 'backup content should match original');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('returns the backup directory path', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'curato-backup-ret-'));
    try {
      const sourceFile = join(tmpDir, 'test.json');
      writeFileSync(sourceFile, '{}');

      const backupDir = backupFile(sourceFile);
      assert.ok(typeof backupDir === 'string', 'should return a string path');
      assert.ok(backupDir.startsWith(backupBase), 'path should live under override root');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('does not throw when source file does not exist', () => {
    assert.doesNotThrow(() => {
      backupFile('/nonexistent/path/settings.json');
    });
  });

  test('two backups create different timestamped dirs', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'curato-backup-2-'));
    try {
      const sourceFile = join(tmpDir, 'settings.json');
      writeFileSync(sourceFile, '{"version":1}');

      const dir1 = backupFile(sourceFile);
      await new Promise((r) => setTimeout(r, 1100));
      const dir2 = backupFile(sourceFile);

      assert.ok(existsSync(dir1));
      assert.ok(existsSync(dir2));
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

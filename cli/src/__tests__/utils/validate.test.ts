import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { assertSafeName, assertPathUnderHome, isAllowedRemoteHost } from '../../utils/validate.js';

describe('assertSafeName', () => {
  test('accepts valid plugin names', () => {
    assert.doesNotThrow(() => assertSafeName('superpowers', 'plugin'));
    assert.doesNotThrow(() => assertSafeName('chrome-devtools', 'plugin'));
    assert.doesNotThrow(() => assertSafeName('my_plugin.v2', 'plugin'));
    assert.doesNotThrow(() => assertSafeName('a1', 'plugin'));
  });

  test('rejects path traversal attempts', () => {
    assert.throws(() => assertSafeName('../etc', 'plugin'), /Invalid plugin name/);
    assert.throws(() => assertSafeName('..', 'plugin'), /Invalid plugin name/);
    assert.throws(() => assertSafeName('a/b', 'plugin'), /Invalid plugin name/);
    assert.throws(() => assertSafeName('a\\b', 'skill'), /Invalid skill name/);
  });

  test('rejects empty and non-string input', () => {
    assert.throws(() => assertSafeName('', 'plugin'), /must be a non-empty string/);
    assert.throws(() => assertSafeName(null as unknown as string, 'plugin'), /must be a non-empty string/);
  });

  test('rejects names starting with special chars', () => {
    assert.throws(() => assertSafeName('-plugin', 'plugin'), /Invalid plugin name/);
    assert.throws(() => assertSafeName('.plugin', 'plugin'), /Invalid plugin name/);
    assert.throws(() => assertSafeName('_plugin', 'plugin'), /Invalid plugin name/);
  });

  test('rejects oversized names', () => {
    const long = 'a'.repeat(101);
    assert.throws(() => assertSafeName(long, 'plugin'), /max 100 characters/);
  });
});

describe('assertPathUnderHome', () => {
  test('accepts paths under home', () => {
    const valid = join(homedir(), '.zshrc');
    assert.doesNotThrow(() => assertPathUnderHome(valid, 'sourceFile'));
  });

  test('expands ~/ syntax', () => {
    const result = assertPathUnderHome('~/.zshrc', 'sourceFile');
    assert.equal(result, join(homedir(), '.zshrc'));
  });

  test('rejects paths outside home', () => {
    assert.throws(() => assertPathUnderHome('/tmp/evil.sh', 'sourceFile'), /must resolve under/);
    assert.throws(() => assertPathUnderHome('/etc/passwd', 'sourceFile'), /must resolve under/);
  });

  test('rejects empty path', () => {
    assert.throws(() => assertPathUnderHome('', 'sourceFile'), /must be a non-empty string/);
  });

  test('rejects path traversal that escapes home', () => {
    const escape = join(homedir(), '..', '..', 'etc', 'passwd');
    assert.throws(() => assertPathUnderHome(escape, 'sourceFile'), /must resolve under/);
  });
});

describe('isAllowedRemoteHost', () => {
  test('accepts raw.githubusercontent.com', () => {
    assert.equal(isAllowedRemoteHost('https://raw.githubusercontent.com/org/repo/main/file.json'), true);
  });

  test('rejects other hosts', () => {
    assert.equal(isAllowedRemoteHost('https://evil.example.com/payload.json'), false);
    assert.equal(isAllowedRemoteHost('https://github.com/org/repo'), false);
    assert.equal(isAllowedRemoteHost('http://localhost/foo'), false);
  });

  test('rejects malformed urls', () => {
    assert.equal(isAllowedRemoteHost('not-a-url'), false);
    assert.equal(isAllowedRemoteHost(''), false);
  });
});

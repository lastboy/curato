import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  buildPlist,
  installShellEnv,
  uninstallShellEnv,
  readInstalledVars,
  LAUNCH_AGENT_LABEL,
} from '../../patcher/shell-env.js';

describe('buildPlist', () => {
  test('embeds the var names and source file path', () => {
    const plist = buildPlist(['ADO_MCP_AUTH_TOKEN', 'GITHUB_TOKEN'], '/home/me/.zshrc');
    assert.ok(plist.includes('ADO_MCP_AUTH_TOKEN GITHUB_TOKEN'), 'should list both vars');
    assert.ok(plist.includes('/home/me/.zshrc'), 'should reference source file');
    assert.ok(plist.includes(`<string>${LAUNCH_AGENT_LABEL}</string>`), 'should have label');
  });

  test('escapes XML special chars (&amp;)', () => {
    const plist = buildPlist(['X'], '/path');
    assert.ok(plist.includes('&amp;&amp;'), 'shell && should be XML-escaped');
    assert.ok(!plist.match(/[^&]&&/), 'no raw && should appear outside escaped form');
  });

  test('NEVER includes a token value — only names', () => {
    const plist = buildPlist(['ADO_MCP_AUTH_TOKEN'], '/tmp/.zshrc');
    assert.ok(!plist.match(/[a-f0-9]{40,}/i), 'plist should not contain hex token-like strings');
    assert.ok(!plist.includes('export '), 'plist should not embed export statements');
  });
});

describe('installShellEnv (dryRun)', () => {
  test('returns plist content without writing', () => {
    const result = installShellEnv({
      vars: ['FOO_TOKEN'],
      sourceFile: join(homedir(), '.zshrc-test'),
      dryRun: true,
    });
    assert.equal(result.wrote, false);
    assert.equal(result.loaded, false);
    assert.ok(result.plistContent.includes('FOO_TOKEN'));
  });

  test('rejects sourceFile outside home directory', () => {
    assert.throws(
      () => installShellEnv({
        vars: ['FOO_TOKEN'],
        sourceFile: '/tmp/evil.sh',
        dryRun: true,
      }),
      /must resolve under/,
    );
  });

  test('rejects invalid var names', () => {
    assert.throws(
      () => installShellEnv({ vars: ['has space'], dryRun: true }),
      /Invalid env var name/,
    );
    assert.throws(
      () => installShellEnv({ vars: ['foo-bar'], dryRun: true }),
      /Invalid env var name/,
    );
    assert.throws(
      () => installShellEnv({ vars: [''], dryRun: true }),
      /Invalid env var name/,
    );
  });

  test('rejects empty var list', () => {
    assert.throws(
      () => installShellEnv({ vars: [], dryRun: true }),
      /at least one var/,
    );
  });
});

describe('installShellEnv + uninstallShellEnv (real filesystem, tmp target)', () => {
  let tmpDir: string;
  let plistPath: string;

  before(() => {
    tmpDir = mkdtempSync(join(homedir(), '.curato-shell-env-test-'));
    plistPath = join(tmpDir, 'test.plist');
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writes plist to targetPath when skipLoad=true', () => {
    const fakeZshrc = join(tmpDir, 'fake.zshrc');
    const result = installShellEnv({
      vars: ['ADO_MCP_AUTH_TOKEN'],
      sourceFile: fakeZshrc,
      dryRun: false,
      targetPath: plistPath,
      skipLoad: true,
    });
    assert.equal(result.wrote, true);
    assert.equal(result.loaded, false);
    assert.ok(existsSync(plistPath), 'plist file should exist on disk');
    const content = readFileSync(plistPath, 'utf8');
    assert.ok(content.includes('ADO_MCP_AUTH_TOKEN'));
    assert.ok(content.includes(fakeZshrc));
  });

  test('readInstalledVars reads var list back from installed plist', () => {
    const vars = readInstalledVars(plistPath);
    assert.deepEqual(vars, ['ADO_MCP_AUTH_TOKEN']);
  });

  test('readInstalledVars returns [] when plist does not exist', () => {
    const vars = readInstalledVars(join(tmpDir, 'nonexistent.plist'));
    assert.deepEqual(vars, []);
  });

  test('uninstall removes the plist', () => {
    const result = uninstallShellEnv({
      dryRun: false,
      targetPath: plistPath,
      skipUnload: true,
    });
    assert.equal(result.existed, true);
    assert.equal(result.removed, true);
    assert.equal(existsSync(plistPath), false, 'plist should be removed');
  });

  test('uninstall on non-existent plist is a no-op', () => {
    const result = uninstallShellEnv({
      dryRun: false,
      targetPath: join(tmpDir, 'ghost.plist'),
      skipUnload: true,
    });
    assert.equal(result.existed, false);
    assert.equal(result.removed, false);
  });
});

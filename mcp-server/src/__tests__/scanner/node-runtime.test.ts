import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseMinVersion, scanNodeRuntime } from '../../scanner/node-runtime.js';

describe('parseMinVersion', () => {
  test('v24.13.1 meets minimum', () => {
    assert.equal(parseMinVersion('v24.13.1'), true);
  });

  test('v18.0.0 meets minimum exactly', () => {
    assert.equal(parseMinVersion('v18.0.0'), true);
  });

  test('v16.0.0 does not meet minimum', () => {
    assert.equal(parseMinVersion('v16.0.0'), false);
  });

  test('v17.9.9 does not meet minimum', () => {
    assert.equal(parseMinVersion('v17.9.9'), false);
  });

  test('handles version without v prefix', () => {
    assert.equal(parseMinVersion('20.0.0'), true);
  });

  test('handles empty string gracefully', () => {
    assert.equal(parseMinVersion(''), false);
  });

  test('handles "unknown" gracefully', () => {
    assert.equal(parseMinVersion('unknown'), false);
  });
});

describe('scanNodeRuntime', () => {
  test('returns a NodeRuntimeInfo object', () => {
    const info = scanNodeRuntime();
    assert.ok(typeof info.nodeVersion === 'string', 'nodeVersion should be string');
    assert.ok(typeof info.nodeMinMet === 'boolean', 'nodeMinMet should be boolean');
    assert.ok(typeof info.nodePath === 'string', 'nodePath should be string');
    assert.ok(typeof info.npmVersion === 'string', 'npmVersion should be string');
    assert.ok(typeof info.nvmActive === 'boolean', 'nvmActive should be boolean');
    assert.ok(typeof info.pathContainsNvm === 'boolean', 'pathContainsNvm should be boolean');
  });

  test('reports current node version correctly', () => {
    const info = scanNodeRuntime();
    // We're running on Node v24 so this should pass
    assert.equal(info.nodeMinMet, true);
    assert.match(info.nodeVersion, /^v\d+\.\d+\.\d+$/);
  });

  test('detects NVM_DIR env var', () => {
    const info = scanNodeRuntime();
    const nvmDir = process.env['NVM_DIR'] ?? '';
    if (nvmDir) {
      // If NVM_DIR is set, nvmActive depends on whether the dir exists
      assert.ok(typeof info.nvmActive === 'boolean');
    } else {
      assert.equal(info.nvmActive, false);
    }
  });

  test('detects NVM_HOME (nvm-windows) when set to an existing directory', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'nvm-home-test-'));
    const savedNvmHome = process.env['NVM_HOME'];
    const savedNvmDir = process.env['NVM_DIR'];
    try {
      delete process.env['NVM_DIR'];
      process.env['NVM_HOME'] = tmpDir;
      const info = scanNodeRuntime();
      assert.equal(info.nvmActive, true, 'nvmActive should be true when NVM_HOME points to existing dir');
    } finally {
      if (savedNvmHome !== undefined) process.env['NVM_HOME'] = savedNvmHome;
      else delete process.env['NVM_HOME'];
      if (savedNvmDir !== undefined) process.env['NVM_DIR'] = savedNvmDir;
      rmdirSync(tmpDir);
    }
  });

  test('pathContainsNvm detects Windows-style nvm path segment', () => {
    const savedPath = process.env['PATH'];
    try {
      process.env['PATH'] = 'C:\\Users\\user\\AppData\\Roaming\\nvm\\v20.11.0';
      const info = scanNodeRuntime();
      assert.equal(info.pathContainsNvm, true, 'should detect \\nvm\\ in Windows PATH');
    } finally {
      if (savedPath !== undefined) process.env['PATH'] = savedPath;
      else delete process.env['PATH'];
    }
  });
});

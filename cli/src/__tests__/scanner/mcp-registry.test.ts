import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanMcpRegistry } from '../../scanner/mcp-registry.js';

describe('scanMcpRegistry', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'curato-test-mcp-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns empty array when .mcp.json is missing', () => {
    const entries = scanMcpRegistry(tmpDir);
    // Only global entries, which may or may not exist
    assert.ok(Array.isArray(entries));
  });

  test('parses a valid .mcp.json and returns entries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-mcp-parse-'));
    try {
      writeFileSync(
        join(dir, '.mcp.json'),
        JSON.stringify({
          'my-server': { command: 'node', args: ['server.js'] },
        }),
      );
      const entries = scanMcpRegistry(dir);
      const mine = entries.find((e) => e.name === 'my-server');
      assert.ok(mine, 'my-server entry should be present');
      assert.equal(mine!.command, 'node');
      assert.equal(mine!.registeredIn, 'project');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('flags binaryResolvable:true for "node" command (always on PATH)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-mcp-node-'));
    try {
      writeFileSync(
        join(dir, '.mcp.json'),
        JSON.stringify({ 'node-server': { command: 'node', args: ['index.js'] } }),
      );
      const entries = scanMcpRegistry(dir);
      const e = entries.find((e) => e.name === 'node-server');
      assert.ok(e, 'entry should exist');
      assert.equal(e!.binaryResolvable, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('flags binaryResolvable:false for nonexistent absolute path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-mcp-nobin-'));
    try {
      writeFileSync(
        join(dir, '.mcp.json'),
        JSON.stringify({
          'missing-server': { command: '/nonexistent/bin/my-mcp-server' },
        }),
      );
      const entries = scanMcpRegistry(dir);
      const e = entries.find((e) => e.name === 'missing-server');
      assert.ok(e, 'entry should exist');
      assert.equal(e!.binaryResolvable, false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('does not throw on malformed .mcp.json', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-mcp-bad-'));
    try {
      writeFileSync(join(dir, '.mcp.json'), '{ invalid json }');
      assert.doesNotThrow(() => scanMcpRegistry(dir));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

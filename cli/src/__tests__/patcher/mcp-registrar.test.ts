import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerMcpServer } from '../../patcher/mcp-registrar.js';

describe('registerMcpServer', () => {
  test('adds MCP entry to settings.json with no mcpServers key', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-reg-'));
    try {
      const settingsPath = join(dir, 'settings.json');
      writeFileSync(settingsPath, JSON.stringify({ permissions: { allow: [] } }));

      registerMcpServer({
        serverName: 'my-server',
        entry: { command: 'node', args: ['server.js'] },
        dryRun: false,
        settingsPath,
      });

      const updated = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
      const mcp = updated['mcpServers'] as Record<string, unknown>;
      assert.ok(mcp, 'mcpServers should be present');
      assert.ok('my-server' in mcp, 'my-server should be registered');
      // Original key preserved
      assert.ok('permissions' in updated, 'permissions key should still be present');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('adds entry to settings.json that already has other servers', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-reg-exist-'));
    try {
      const settingsPath = join(dir, 'settings.json');
      writeFileSync(
        settingsPath,
        JSON.stringify({
          mcpServers: {
            'existing-server': { command: 'npx', args: ['existing'] },
          },
        }),
      );

      registerMcpServer({
        serverName: 'new-server',
        entry: { command: 'node', args: ['new.js'] },
        dryRun: false,
        settingsPath,
      });

      const updated = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
      const mcp = updated['mcpServers'] as Record<string, unknown>;
      assert.ok('existing-server' in mcp, 'existing server should still be present');
      assert.ok('new-server' in mcp, 'new server should be added');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('does not duplicate an entry that already exists (idempotent)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-reg-idem-'));
    try {
      const settingsPath = join(dir, 'settings.json');
      writeFileSync(
        settingsPath,
        JSON.stringify({
          mcpServers: {
            'my-server': { command: 'node', args: ['original.js'] },
          },
        }),
      );

      registerMcpServer({
        serverName: 'my-server',
        entry: { command: 'node', args: ['new-version.js'] },
        dryRun: false,
        settingsPath,
      });

      const updated = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
      const mcp = updated['mcpServers'] as Record<string, { args: string[] }>;
      // Original entry should be unchanged (target wins in safeMerge)
      assert.deepEqual(mcp['my-server'].args, ['original.js']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('dryRun:true returns proposal without writing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-reg-dry-'));
    try {
      const settingsPath = join(dir, 'settings.json');
      writeFileSync(settingsPath, JSON.stringify({ permissions: { allow: [] } }));
      const mtimeBefore = statSync(settingsPath).mtimeMs;

      const result = registerMcpServer({
        serverName: 'dry-server',
        entry: { command: 'node', args: ['dry.js'] },
        dryRun: true,
        settingsPath,
      });

      assert.equal(result.dryRun, true);
      assert.equal(result.alreadyPresent, false);
      assert.ok(result.proposed.includes('dry-server'), 'proposed JSON should include server name');

      const after = statSync(settingsPath).mtimeMs;
      assert.equal(after, mtimeBefore, 'file should not be modified in dry-run');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('creates settings.json when it does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-reg-new-'));
    try {
      const settingsPath = join(dir, 'settings.json');

      registerMcpServer({
        serverName: 'new-server',
        entry: { command: 'node', args: ['s.js'] },
        dryRun: false,
        settingsPath,
      });

      assert.ok(existsSync(settingsPath));
      const content = JSON.parse(readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
      assert.ok('mcpServers' in content);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

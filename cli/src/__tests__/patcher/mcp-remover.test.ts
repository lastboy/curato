import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { removeMcpServer } from '../../patcher/mcp-remover.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'curato-remove-'));
}

function write(path: string, obj: unknown) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function read(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

describe('removeMcpServer', () => {
  test('removes from settings.json', () => {
    const dir = tempDir();
    try {
      const settingsJsonPath = join(dir, 'settings.json');
      write(settingsJsonPath, { mcpServers: { 'my-server': { command: 'node' }, 'other': { command: 'npx' } } });

      const result = removeMcpServer({
        serverName: 'my-server',
        dryRun: false,
        settingsJsonPath,
        settingsLocalJsonPath: join(dir, 'settings.local.json'),
        claudeJsonPath: join(dir, 'claude.json'),
        mcpJsonPath: join(dir, '.mcp.json'),
      });

      assert.ok(result.removedFrom.includes('~/.claude/settings.json'));
      const updated = read(settingsJsonPath);
      const mcp = updated['mcpServers'] as Record<string, unknown>;
      assert.ok(!('my-server' in mcp), 'my-server should be gone');
      assert.ok('other' in mcp, 'other server should remain');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('removes from settings.local.json', () => {
    const dir = tempDir();
    try {
      const settingsLocalJsonPath = join(dir, 'settings.local.json');
      write(settingsLocalJsonPath, { mcpServers: { 'my-server': { command: 'node' } } });

      const result = removeMcpServer({
        serverName: 'my-server',
        dryRun: false,
        settingsJsonPath: join(dir, 'settings.json'),
        settingsLocalJsonPath,
        claudeJsonPath: join(dir, 'claude.json'),
        mcpJsonPath: join(dir, '.mcp.json'),
      });

      assert.ok(result.removedFrom.includes('~/.claude/settings.local.json'));
      const updated = read(settingsLocalJsonPath);
      const mcp = updated['mcpServers'] as Record<string, unknown>;
      assert.ok(!('my-server' in mcp));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('removes from .mcp.json', () => {
    const dir = tempDir();
    try {
      const mcpJsonPath = join(dir, '.mcp.json');
      write(mcpJsonPath, { mcpServers: { 'my-server': { command: 'node' }, 'keep': { command: 'npx' } } });

      const result = removeMcpServer({
        serverName: 'my-server',
        dryRun: false,
        settingsJsonPath: join(dir, 'settings.json'),
        settingsLocalJsonPath: join(dir, 'settings.local.json'),
        claudeJsonPath: join(dir, 'claude.json'),
        mcpJsonPath,
      });

      assert.ok(result.removedFrom.includes('.mcp.json'));
      const updated = read(mcpJsonPath);
      const mcp = updated['mcpServers'] as Record<string, unknown>;
      assert.ok(!('my-server' in mcp));
      assert.ok('keep' in mcp);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('removes from claude.json top-level mcpServers', () => {
    const dir = tempDir();
    try {
      const claudeJsonPath = join(dir, 'claude.json');
      write(claudeJsonPath, { mcpServers: { 'my-server': { command: 'node' } } });

      const result = removeMcpServer({
        serverName: 'my-server',
        dryRun: false,
        settingsJsonPath: join(dir, 'settings.json'),
        settingsLocalJsonPath: join(dir, 'settings.local.json'),
        claudeJsonPath,
        mcpJsonPath: join(dir, '.mcp.json'),
      });

      assert.ok(result.removedFrom.includes('~/.claude.json'));
      const updated = read(claudeJsonPath);
      const mcp = updated['mcpServers'] as Record<string, unknown>;
      assert.ok(!('my-server' in mcp));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('removes from claude.json project-scoped entry', () => {
    const dir = tempDir();
    try {
      const claudeJsonPath = join(dir, 'claude.json');
      write(claudeJsonPath, {
        projects: {
          '/some/project': { mcpServers: { 'my-server': { command: 'node' }, 'keep': { command: 'npx' } } },
        },
      });

      const result = removeMcpServer({
        serverName: 'my-server',
        dryRun: false,
        settingsJsonPath: join(dir, 'settings.json'),
        settingsLocalJsonPath: join(dir, 'settings.local.json'),
        claudeJsonPath,
        mcpJsonPath: join(dir, '.mcp.json'),
      });

      assert.ok(result.removedFrom.some((s) => s.includes('projects./some/project')));
      const updated = read(claudeJsonPath);
      const projects = updated['projects'] as Record<string, { mcpServers: Record<string, unknown> }>;
      assert.ok(!('my-server' in projects['/some/project'].mcpServers));
      assert.ok('keep' in projects['/some/project'].mcpServers);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('removes from all sources simultaneously', () => {
    const dir = tempDir();
    try {
      const settingsJsonPath = join(dir, 'settings.json');
      const settingsLocalJsonPath = join(dir, 'settings.local.json');
      const claudeJsonPath = join(dir, 'claude.json');
      const mcpJsonPath = join(dir, '.mcp.json');

      write(settingsJsonPath, { mcpServers: { 'my-server': { command: 'node' } } });
      write(settingsLocalJsonPath, { mcpServers: { 'my-server': { command: 'node' } } });
      write(claudeJsonPath, { mcpServers: { 'my-server': { command: 'node' } } });
      write(mcpJsonPath, { mcpServers: { 'my-server': { command: 'node' } } });

      const result = removeMcpServer({
        serverName: 'my-server',
        dryRun: false,
        settingsJsonPath,
        settingsLocalJsonPath,
        claudeJsonPath,
        mcpJsonPath,
      });

      assert.equal(result.removedFrom.length, 4);
      assert.equal(result.notFound.length, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('dryRun:true reports what would be removed without writing', () => {
    const dir = tempDir();
    try {
      const settingsJsonPath = join(dir, 'settings.json');
      const mcpJsonPath = join(dir, '.mcp.json');
      write(settingsJsonPath, { mcpServers: { 'my-server': { command: 'node' } } });
      write(mcpJsonPath, { mcpServers: { 'my-server': { command: 'node' } } });

      const mtimeBefore = {
        settings: readFileSync(settingsJsonPath).toString(),
        mcp: readFileSync(mcpJsonPath).toString(),
      };

      const result = removeMcpServer({
        serverName: 'my-server',
        dryRun: true,
        settingsJsonPath,
        settingsLocalJsonPath: join(dir, 'settings.local.json'),
        claudeJsonPath: join(dir, 'claude.json'),
        mcpJsonPath,
      });

      assert.equal(result.dryRun, true);
      assert.ok(result.removedFrom.includes('~/.claude/settings.json'));
      assert.ok(result.removedFrom.includes('.mcp.json'));
      // Files must be unchanged
      assert.equal(readFileSync(settingsJsonPath).toString(), mtimeBefore.settings);
      assert.equal(readFileSync(mcpJsonPath).toString(), mtimeBefore.mcp);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('reports notFound when server is absent from all sources', () => {
    const dir = tempDir();
    try {
      const result = removeMcpServer({
        serverName: 'ghost-server',
        dryRun: false,
        settingsJsonPath: join(dir, 'settings.json'),
        settingsLocalJsonPath: join(dir, 'settings.local.json'),
        claudeJsonPath: join(dir, 'claude.json'),
        mcpJsonPath: join(dir, '.mcp.json'),
      });

      assert.equal(result.removedFrom.length, 0);
      assert.ok(result.notFound.length > 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

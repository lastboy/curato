import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanProjectLayout } from '../../scanner/project-layout.js';

describe('scanProjectLayout', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'curato-layout-'));
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('hasClaudeDir:false when .claude/ absent', () => {
    const layout = scanProjectLayout(tmpDir);
    assert.equal(layout.hasClaudeDir, false);
  });

  test('hasClaudeDir:true when .claude/ present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-layout-claude-'));
    try {
      mkdirSync(join(dir, '.claude'));
      const layout = scanProjectLayout(dir);
      assert.equal(layout.hasClaudeDir, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('hasClaudeMd:false when CLAUDE.md absent', () => {
    const layout = scanProjectLayout(tmpDir);
    assert.equal(layout.hasClaudeMd, false);
  });

  test('hasClaudeMd:true when CLAUDE.md present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-layout-md-'));
    try {
      writeFileSync(join(dir, 'CLAUDE.md'), '# Test');
      const layout = scanProjectLayout(dir);
      assert.equal(layout.hasClaudeMd, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('hasMcpJson:false when .mcp.json absent', () => {
    const layout = scanProjectLayout(tmpDir);
    assert.equal(layout.hasMcpJson, false);
  });

  test('hasMcpJson:true when .mcp.json present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-layout-mcp-'));
    try {
      writeFileSync(join(dir, '.mcp.json'), '{}');
      const layout = scanProjectLayout(dir);
      assert.equal(layout.hasMcpJson, true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('agentFiles populated from .claude/agents/*.md', () => {
    const dir = mkdtempSync(join(tmpdir(), 'curato-layout-agents-'));
    try {
      const agentsDir = join(dir, '.claude', 'agents');
      mkdirSync(agentsDir, { recursive: true });
      writeFileSync(join(agentsDir, 'my-agent.md'), '# Agent');
      writeFileSync(join(agentsDir, 'other-agent.md'), '# Agent 2');
      writeFileSync(join(agentsDir, 'not-an-agent.txt'), 'text');

      const layout = scanProjectLayout(dir);
      assert.equal(layout.agentFiles.length, 2);
      assert.ok(layout.agentFiles.some((f) => f.endsWith('my-agent.md')));
      assert.ok(layout.agentFiles.some((f) => f.endsWith('other-agent.md')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('agentFiles empty when .claude/agents/ absent', () => {
    const layout = scanProjectLayout(tmpDir);
    assert.equal(layout.agentFiles.length, 0);
  });

  test('cwd is set correctly', () => {
    const layout = scanProjectLayout(tmpDir);
    assert.equal(layout.cwd, tmpDir);
  });
});

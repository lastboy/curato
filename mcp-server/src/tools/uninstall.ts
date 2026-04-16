import { register } from './index.js';
import { toolResult } from '../types.js';
import type { UninstallCuratoParams, UninstallReport } from '../types.js';
import { backupFile } from '../patcher/backup.js';
import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { claudeBin, getClaudeDir, getClaudeJsonPath } from '../utils/platform.js';

register(
  {
    name: 'uninstall_curato',
    description:
      'Full teardown: uninstall all plugins, remove all MCP servers from both registries, and clear all plugin caches. Use dryRun:true to preview. Backs up registry files before writing.',
    inputSchema: {
      type: 'object',
      required: ['dryRun'],
      properties: {
        dryRun: { type: 'boolean', description: 'If true, return what would be removed without making any changes' },
      },
    },
  },
  async (args) => {
    const { dryRun } = args as UninstallCuratoParams;

    const pluginsJsonPath = join(getClaudeDir(), 'plugins', 'installed_plugins.json');
    const settingsJsonPath = join(getClaudeDir(), 'settings.json');
    const claudeJsonPath = getClaudeJsonPath();
    const cacheRoot = join(getClaudeDir(), 'plugins', 'cache');

    // ── Discover ────────────────────────────────────────────────────────────

    // Plugins
    let installedPlugins: { version: number; plugins: Record<string, unknown[]> } = { version: 2, plugins: {} };
    if (existsSync(pluginsJsonPath)) {
      try {
        installedPlugins = JSON.parse(readFileSync(pluginsJsonPath, 'utf8')) as typeof installedPlugins;
      } catch { /* leave empty */ }
    }
    const pluginKeys = Object.keys(installedPlugins.plugins);
    const pluginNames = [...new Set(pluginKeys.map((k) => k.split('@')[0]))];

    // MCP servers — VS Code registry
    let settingsJson: Record<string, unknown> = {};
    if (existsSync(settingsJsonPath)) {
      try { settingsJson = JSON.parse(readFileSync(settingsJsonPath, 'utf8')) as Record<string, unknown>; }
      catch { /* leave empty */ }
    }
    const settingsMcp =
      settingsJson['mcpServers'] && typeof settingsJson['mcpServers'] === 'object' && !Array.isArray(settingsJson['mcpServers'])
        ? (settingsJson['mcpServers'] as Record<string, unknown>)
        : {};

    // MCP servers — CLI registry
    let claudeJson: Record<string, unknown> = {};
    if (existsSync(claudeJsonPath)) {
      try {
        const parsed: unknown = JSON.parse(readFileSync(claudeJsonPath, 'utf8'));
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          claudeJson = parsed as Record<string, unknown>;
        }
      } catch { /* leave empty */ }
    }
    const claudeMcp =
      claudeJson['mcpServers'] && typeof claudeJson['mcpServers'] === 'object' && !Array.isArray(claudeJson['mcpServers'])
        ? (claudeJson['mcpServers'] as Record<string, unknown>)
        : {};

    const mcpServerNames = [...new Set([...Object.keys(settingsMcp), ...Object.keys(claudeMcp)])];

    // Cache dirs
    const cacheDirs: string[] = [];
    if (existsSync(cacheRoot)) {
      for (const marketplace of readdirSync(cacheRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
        const mDir = join(cacheRoot, marketplace.name);
        for (const plugin of readdirSync(mDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
          cacheDirs.push(join(mDir, plugin.name));
        }
      }
    }

    if (dryRun) {
      const report: UninstallReport = {
        dryRun: true,
        pluginsRemoved: pluginNames,
        mcpServersRemoved: mcpServerNames,
        cacheDirsCleared: cacheDirs,
        errors: [],
      };
      return toolResult(report);
    }

    // ── Apply ────────────────────────────────────────────────────────────────

    const errors: string[] = [];
    const pluginsRemoved: string[] = [];
    const mcpServersRemoved: string[] = [];
    const cacheDirsCleared: string[] = [];
    const backupDirs: string[] = [];

    // Phase 1: Backup installed_plugins.json, then uninstall plugins
    if (existsSync(pluginsJsonPath)) {
      backupDirs.push(backupFile(pluginsJsonPath));
    }
    for (const name of pluginNames) {
      const result = spawnSync(claudeBin(), ['plugin', 'uninstall', name], { encoding: 'utf8' });
      if (result.status === 0) {
        pluginsRemoved.push(name);
      } else {
        errors.push(`plugin uninstall ${name}: ${result.stderr?.trim() ?? 'unknown error'}`);
      }
    }
    // Wipe installed_plugins.json regardless of CLI result
    if (existsSync(pluginsJsonPath)) {
      writeFileSync(pluginsJsonPath, JSON.stringify({ version: 2, plugins: {} }, null, 2) + '\n', 'utf8');
    }

    // Phase 2: Remove MCP servers from VS Code registry
    if (Object.keys(settingsMcp).length > 0) {
      backupDirs.push(backupFile(settingsJsonPath));
      settingsJson['mcpServers'] = {};
      writeFileSync(settingsJsonPath, JSON.stringify(settingsJson, null, 2) + '\n', 'utf8');
      mcpServersRemoved.push(...Object.keys(settingsMcp));
    }

    // Remove MCP servers from CLI registry (top-level + project-scoped)
    let claudeChanged = false;
    if (Object.keys(claudeMcp).length > 0) {
      backupDirs.push(backupFile(claudeJsonPath));
      claudeJson['mcpServers'] = {};
      claudeChanged = true;
      for (const name of Object.keys(claudeMcp)) {
        if (!mcpServersRemoved.includes(name)) mcpServersRemoved.push(name);
      }
    }
    // Also clear project-scoped MCP entries
    const projects = claudeJson['projects'];
    if (projects && typeof projects === 'object' && !Array.isArray(projects)) {
      for (const [, projectVal] of Object.entries(projects as Record<string, unknown>)) {
        if (projectVal && typeof projectVal === 'object' && !Array.isArray(projectVal)) {
          const pv = projectVal as Record<string, unknown>;
          if (pv['mcpServers']) {
            if (!claudeChanged) {
              backupDirs.push(backupFile(claudeJsonPath));
              claudeChanged = true;
            }
            pv['mcpServers'] = {};
          }
        }
      }
    }
    if (claudeChanged) {
      writeFileSync(claudeJsonPath, JSON.stringify(claudeJson, null, 2) + '\n', 'utf8');
    }

    // Phase 3: Clear cache dirs (ephemeral — re-downloadable from marketplace, no backup needed)
    for (const dir of cacheDirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
        cacheDirsCleared.push(dir);
      } catch (e) {
        errors.push(`rmSync ${dir}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const report: UninstallReport = {
      dryRun: false,
      pluginsRemoved,
      mcpServersRemoved,
      cacheDirsCleared,
      backupDirs: backupDirs.length > 0 ? backupDirs : undefined,
      errors,
    };
    return toolResult(report);
  },
);

import { register } from './index.js';
import { toolResult } from '../types.js';
import type { CheckPluginStateParams, RemovePluginParams, ClearPluginCacheParams } from '../types.js';
import { scanPluginState } from '../scanner/plugin-state.js';
import { backupFile } from '../patcher/backup.js';
import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { claudeBin } from '../utils/platform.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function readInstalledPlugins(path: string): { version: number; plugins: Record<string, unknown[]> } {
  if (!existsSync(path)) return { version: 2, plugins: {} };
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as { version: number; plugins: Record<string, unknown[]> };
  } catch {
    return { version: 2, plugins: {} };
  }
}

// ── Tools ─────────────────────────────────────────────────────────────────────

register(
  {
    name: 'check_plugin_state',
    description:
      'Validate Claude Code plugin installations. Checks plugin.json schema, required fields, and consistency. Returns PluginInfo[].',
    inputSchema: {
      type: 'object',
      properties: {
        pluginName: {
          type: 'string',
          description: 'Specific plugin name to check (omit to check all)',
        },
      },
    },
  },
  async (args) => {
    const { pluginName } = (args as CheckPluginStateParams) ?? {};
    return toolResult(scanPluginState(pluginName));
  },
);

register(
  {
    name: 'remove_plugin',
    description:
      'Uninstall a named Claude Code plugin and clear its cache directories. Use dryRun:true to preview what would be removed.',
    inputSchema: {
      type: 'object',
      required: ['pluginName', 'dryRun'],
      properties: {
        pluginName: { type: 'string', description: 'Name of the plugin to remove (e.g. "superpowers")' },
        dryRun: { type: 'boolean', description: 'If true, return what would be removed without making changes' },
      },
    },
  },
  async (args) => {
    const { pluginName, dryRun } = args as RemovePluginParams;
    const pluginsJsonPath = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
    const installed = readInstalledPlugins(pluginsJsonPath);

    // Find all entries matching this plugin name (key: "<pluginName>@<marketplace>")
    const matchingKeys = Object.keys(installed.plugins).filter((k) => k.startsWith(pluginName + '@'));
    const cacheDirs: string[] = [];
    for (const key of matchingKeys) {
      for (const entry of installed.plugins[key] as Array<{ installPath?: string }>) {
        if (entry.installPath) cacheDirs.push(entry.installPath);
      }
    }

    if (dryRun) {
      return toolResult({ dryRun, pluginName, matchingKeys, cacheDirs });
    }

    const errors: string[] = [];
    const cacheDirsRemoved: string[] = [];

    // Backup installed_plugins.json BEFORE any mutation (invariant: backup before write)
    let backupDir: string | undefined;
    if (existsSync(pluginsJsonPath)) {
      backupDir = backupFile(pluginsJsonPath);
    }

    // Run claude plugin uninstall only if the plugin is actually installed (skip if not found)
    if (matchingKeys.length > 0) {
      const result = spawnSync(claudeBin(), ['plugin', 'uninstall', pluginName], { encoding: 'utf8' });
      if (result.status !== 0) {
        errors.push(`claude plugin uninstall: ${result.stderr?.trim() ?? 'unknown error'}`);
      }
    }

    // Re-read in case claude CLI updated the file
    const afterCli = readInstalledPlugins(pluginsJsonPath);
    const remainingKeys = Object.keys(afterCli.plugins).filter((k) => k.startsWith(pluginName + '@'));

    // Manually remove leftover cache dirs
    for (const dir of cacheDirs) {
      if (existsSync(dir)) {
        try {
          rmSync(dir, { recursive: true, force: true });
          cacheDirsRemoved.push(dir);
        } catch (e) {
          errors.push(`rmSync ${dir}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    // If entries still remain in installed_plugins.json, remove them manually
    if (remainingKeys.length > 0) {
      for (const key of remainingKeys) {
        delete afterCli.plugins[key];
      }
      writeFileSync(pluginsJsonPath, JSON.stringify(afterCli, null, 2) + '\n', 'utf8');
    }

    return toolResult({ dryRun, pluginName, matchingKeys, cacheDirsRemoved, backupDir, errors });
  },
);

register(
  {
    name: 'clear_plugin_cache',
    description:
      'Clear Claude Code plugin cache directories. Optionally filter by plugin name or marketplace. Omit all filters to clear everything.',
    inputSchema: {
      type: 'object',
      required: ['dryRun'],
      properties: {
        pluginName: { type: 'string', description: 'Only clear cache for this plugin name' },
        marketplaceName: { type: 'string', description: 'Only clear cache for this marketplace' },
        dryRun: { type: 'boolean', description: 'If true, return what would be cleared without deleting' },
      },
    },
  },
  async (args) => {
    const { pluginName, marketplaceName, dryRun } = args as ClearPluginCacheParams;
    const cacheRoot = join(homedir(), '.claude', 'plugins', 'cache');

    const targetDirs: string[] = [];
    const errors: string[] = [];

    if (existsSync(cacheRoot)) {
      const marketplaces = marketplaceName
        ? [marketplaceName]
        : readdirSync(cacheRoot, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name);

      for (const marketplace of marketplaces) {
        const marketplaceDir = join(cacheRoot, marketplace);
        if (!existsSync(marketplaceDir)) continue;

        const plugins = pluginName
          ? [pluginName]
          : readdirSync(marketplaceDir, { withFileTypes: true })
              .filter((d) => d.isDirectory())
              .map((d) => d.name);

        for (const plugin of plugins) {
          const pluginDir = join(marketplaceDir, plugin);
          if (existsSync(pluginDir)) targetDirs.push(pluginDir);
        }
      }
    }

    if (dryRun) {
      return toolResult({ dryRun, wouldClear: targetDirs });
    }

    const cleared: string[] = [];
    const skipped: string[] = [];

    for (const dir of targetDirs) {
      try {
        rmSync(dir, { recursive: true, force: true });
        cleared.push(dir);
      } catch (e) {
        errors.push(`rmSync ${dir}: ${e instanceof Error ? e.message : String(e)}`);
        skipped.push(dir);
      }
    }

    return toolResult({ dryRun, cleared, skipped, errors });
  },
);

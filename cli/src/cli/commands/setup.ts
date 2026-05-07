import { parseArgs } from 'node:util';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readTeamConfig, validateTeamConfig } from '../../scanner/team-config.js';
import { applySkillFilter } from '../../patcher/skill-filter.js';
import { registerMcpServer } from '../../patcher/mcp-registrar.js';
import { safeMerge } from '../../patcher/json-merger.js';
import { backupFile } from '../../patcher/backup.js';
import { claudeBin, getClaudeDir, getClaudeJsonPath } from '../../utils/platform.js';
import { ok, fail, info, warn, bold, dim, line } from '../print.js';
import { installShellEnv } from '../../patcher/shell-env.js';
import type { TeamMcpEntry, TeamPluginEntry, TeamMarketplaceEntry, TeamShellEnvConfig } from '../../types.js';

const HELP = `
USAGE
  curato setup [options]

OPTIONS
  --config <path>   Path to curato-setup.json (default: ./curato-setup.json)
  --dry-run         Preview changes without applying them
  --help            Show this help

EXAMPLES
  curato setup
  curato setup --config ./team/curato-setup.json
  curato setup --dry-run
`;

/**
 * Filter MCP env values for disk-safety:
 * - Literal strings are written as-is.
 * - Values containing `${VAR}` references are dropped entirely — they are
 *   expected to be inherited from the shell at MCP spawn time. This prevents
 *   `curato setup` from leaking secrets (like PATs) into settings.json.
 *
 * If the shell doesn't have the var set when Claude Code launches, the MCP
 * will fail authentication — that's the intended trade-off for not having
 * tokens on disk.
 */
function sanitizeEnv(
  env: Record<string, string>,
  opts: { warn: (msg: string) => void }
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (/\$\{[^}]+\}/.test(v)) {
      opts.warn(`  env.${k}: skipped (references \${VAR}) — will inherit from shell at runtime`);
      continue;
    }
    if (v !== '') out[k] = v;
  }
  return out;
}

function readJson(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch { return {}; }
}

function writeJson(filePath: string, data: Record<string, unknown>) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function setup(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      config:    { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help:      { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) { console.log(HELP); return; }

  const dryRun = values['dry-run'] as boolean;
  const configPath = values.config as string | undefined;
  const cwd = configPath ? dirname(configPath) : process.cwd();

  if (dryRun) dim('dry-run mode — no files will be changed');

  // ── Load config ──────────────────────────────────────────────────────────────

  const config = configPath
    ? (() => { try { return JSON.parse(readFileSync(configPath, 'utf8')) as unknown; } catch { return null; } })()
    : await readTeamConfig(cwd);

  if (!config) {
    fail(`No curato-setup.json found${configPath ? ` at ${configPath}` : ' in current directory'}`);
    dim('Create one to define your team setup. Run curato setup --help for docs.');
    process.exit(1);
  }

  const validation = validateTeamConfig(config);
  if (!validation.valid) {
    fail('Invalid curato-setup.json:');
    for (const e of validation.errors) console.error(`  • ${e}`);
    process.exit(1);
  }

  const cfg = config as Parameters<typeof validateTeamConfig>[0] & {
    shellEnv?: TeamShellEnvConfig;
    marketplaces?: Record<string, TeamMarketplaceEntry>;
    mcpServers?: Record<string, TeamMcpEntry>;
    plugins?: Array<string | TeamPluginEntry>;
    claudeMd?: {
      project?: { mode: string; content: string; section?: string };
      user?: { mode: string; content: string; section?: string };
    };
  };

  const claudeDir = getClaudeDir();
  let hasWork = false;

  // ── Shell env forwarding (macOS LaunchAgent) ─────────────────────────────────

  if (cfg.shellEnv && cfg.shellEnv.enabled !== false && cfg.shellEnv.vars.length > 0) {
    bold('\nShell Env (LaunchAgent)');
    if (process.platform !== 'darwin') {
      warn(`  shellEnv is macOS-only — skipping on ${process.platform}`);
    } else {
      hasWork = true;
      if (dryRun) {
        info(`  would install LaunchAgent forwarding: ${cfg.shellEnv.vars.join(', ')}`);
      } else {
        try {
          const result = installShellEnv({
            vars: cfg.shellEnv.vars,
            sourceFile: cfg.shellEnv.sourceFile,
            dryRun: false,
          });
          ok(`  installed LaunchAgent: ${result.plistPath}`);
          dim(`  forwarding vars: ${result.vars.join(', ')}`);
          if (!result.loaded) warn('  launchctl load failed — reboot or load manually');
        } catch (err) {
          fail(`  shellEnv install failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  // ── Marketplaces ─────────────────────────────────────────────────────────────

  if (cfg.marketplaces && Object.keys(cfg.marketplaces).length > 0) {
    bold('\nMarketplaces');

    // Get already-registered sources so we can skip duplicates
    const listResult = spawnSync(claudeBin(), ['plugin', 'marketplace', 'list', '--json'], {
      encoding: 'utf8',
    });
    let registeredSources = new Set<string>();
    if (listResult.status === 0 && listResult.stdout) {
      try {
        const list = JSON.parse(listResult.stdout) as Array<{ source?: string; url?: string }>;
        if (Array.isArray(list)) {
          registeredSources = new Set(list.map((m) => m.source ?? m.url ?? '').filter(Boolean));
        }
      } catch { /* ignore parse errors — we'll try adding anyway */ }
    }

    for (const [name, entry] of Object.entries(cfg.marketplaces) as [string, TeamMarketplaceEntry][]) {
      if (entry.enabled === false) { dim(`  skip (disabled): ${name}`); continue; }
      hasWork = true;

      if (dryRun) { info(`  would add marketplace: ${name} (${entry.source})`); continue; }

      if (registeredSources.has(entry.source)) {
        dim(`  already registered: ${name}`);
        continue;
      }

      const scope = entry.scope ?? 'user';
      const args = ['plugin', 'marketplace', 'add', entry.source, '--scope', scope];
      if (entry.sparse && entry.sparse.length > 0) args.push('--sparse', ...entry.sparse);

      info(`  adding marketplace: ${name}`);
      const result = spawnSync(claudeBin(), args, { encoding: 'utf8', stdio: 'inherit' });

      if (result.status !== 0) {
        fail(`  failed to add marketplace: ${name}`);
        continue;
      }

      ok(`  added marketplace: ${name}`);
    }
  }

  // ── MCP servers ──────────────────────────────────────────────────────────────

  if (cfg.mcpServers && Object.keys(cfg.mcpServers).length > 0) {
    bold('\nMCP Servers');
    for (const [name, entry] of Object.entries(cfg.mcpServers) as [string, TeamMcpEntry][]) {
      if (entry.enabled === false) { dim(`  skip (disabled): ${name}`); continue; }
      hasWork = true;

      const sanitizedEnv = entry.env ? sanitizeEnv(entry.env, { warn: dim }) : undefined;
      const hasEnv = sanitizedEnv && Object.keys(sanitizedEnv).length > 0;
      const entryObj = {
        command: entry.command,
        ...(entry.args ? { args: entry.args } : {}),
        ...(hasEnv ? { env: sanitizedEnv } : {}),
      };

      if (dryRun) { info(`  would register: ${name}`); continue; }

      const settingsPath = join(claudeDir, 'settings.json');
      const claudeJsonPath = getClaudeJsonPath();

      if (entry.scope === 'project') {
        const mcpJsonPath = join(cwd, '.mcp.json');
        const existing = readJson(mcpJsonPath);
        const servers = (existing['mcpServers'] as Record<string, unknown>) ?? {};
        if (name in servers) { dim(`  already registered (project): ${name}`); continue; }
        backupFile(mcpJsonPath);
        writeJson(mcpJsonPath, safeMerge(existing, { mcpServers: { [name]: entryObj } }));
        ok(`  registered (project): ${name}`);
      } else {
        const vsSettings = readJson(settingsPath);
        const vsServers = (vsSettings['mcpServers'] as Record<string, unknown>) ?? {};
        const inVs = name in vsServers;

        const cliJson = readJson(claudeJsonPath);
        const cliServers = (cliJson['mcpServers'] as Record<string, unknown>) ?? {};
        const inCli = name in cliServers;

        if (inVs && inCli) { dim(`  already registered (user): ${name}`); continue; }

        const vsResult = registerMcpServer({ serverName: name, entry: entryObj, dryRun: false, settingsPath });
        if (vsResult.backupDir) { /* backup recorded */ }

        if (!inCli) {
          backupFile(claudeJsonPath);
          writeJson(claudeJsonPath, safeMerge(cliJson, { mcpServers: { [name]: entryObj } }));
        }

        ok(`  registered (user): ${name}`);
      }
    }
  }

  // ── Plugins ──────────────────────────────────────────────────────────────────

  if (cfg.plugins && cfg.plugins.length > 0) {
    bold('\nPlugins');
    for (const pluginEntry of cfg.plugins) {
      if (typeof pluginEntry !== 'string' && pluginEntry.enabled === false) {
        dim(`  skip (disabled): ${typeof pluginEntry === 'string' ? pluginEntry : pluginEntry.name}`);
        continue;
      }
      hasWork = true;
      const name = typeof pluginEntry === 'string' ? pluginEntry : pluginEntry.name;
      const skills = typeof pluginEntry !== 'string' ? pluginEntry.skills : undefined;

      if (dryRun) {
        info(`  would install: ${name}${skills ? ` (with skill filter)` : ''}`);
        continue;
      }

      info(`  installing: ${name}`);
      const result = spawnSync(claudeBin(), ['plugin', 'install', name], {
        encoding: 'utf8',
        stdio: 'inherit',
      });

      if (result.status !== 0) {
        fail(`  failed to install: ${name}`);
        continue;
      }

      ok(`  installed: ${name}`);

      if (skills) {
        const report = applySkillFilter(name, skills, false);
        if (report.cachePath) {
          ok(`  skill filter applied — ~${report.startupSavingTokens} startup tokens saved`);
        } else {
          warn(`  skill filter: cache not found for "${name}", skipped`);
        }
      }
    }
  }

  // ── CLAUDE.md ────────────────────────────────────────────────────────────────

  for (const [scope, scopeDir] of [['project', cwd], ['user', claudeDir]] as const) {
    const entry = cfg.claudeMd?.[scope];
    if (!entry) continue;
    hasWork = true;

    const targetPath = join(scopeDir, 'CLAUDE.md');
    const before = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : undefined;

    if (entry.mode === 'create-if-missing' && before) {
      dim(`  CLAUDE.md (${scope}): already exists, skipping`);
      continue;
    }

    if (entry.mode === 'append-if-missing-section' && before && entry.section && before.includes(entry.section)) {
      dim(`  CLAUDE.md (${scope}): section already present`);
      continue;
    }

    const after = entry.mode === 'append-if-missing-section' && before
      ? before + '\n\n' + entry.content
      : entry.content;

    bold(`\nCLAUDE.md (${scope})`);
    if (dryRun) { info(`  would write ${targetPath}`); continue; }

    if (before) backupFile(targetPath);
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(targetPath, after, 'utf8');
    ok(`  written: ${targetPath}`);
  }

  line();
  if (!hasWork) {
    ok('Everything already up to date.');
  } else if (dryRun) {
    info('dry-run complete — run without --dry-run to apply.');
  } else {
    ok('Setup complete. Reload Claude Code to pick up changes.');
    dim('Note: backups in ~/.curato-backups/ may contain literal token values.');
    dim('      Run `curato clean-backups` periodically to prune old copies.');
  }
}

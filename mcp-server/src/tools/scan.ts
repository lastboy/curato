import { existsSync } from 'node:fs';
import { join, isAbsolute, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { register } from './index.js';
import { toolResult } from '../types.js';
import type { ScanReport, CheckResult, ScanEnvironmentParams } from '../types.js';
import { scanNodeRuntime, parseMinVersion } from '../scanner/node-runtime.js';
import { scanUserSetup } from '../scanner/claude-config.js';
import { claudeBin } from '../utils/platform.js';
import { scanMcpRegistry } from '../scanner/mcp-registry.js';
import { scanPluginState } from '../scanner/plugin-state.js';
import { scanProjectLayout } from '../scanner/project-layout.js';

export function buildNodeChecks(): CheckResult[] {
  const info = scanNodeRuntime();
  const checks: CheckResult[] = [];

  checks.push({
    id: 'node.version',
    label: 'Node.js Version',
    severity: info.nodeMinMet ? 'ok' : 'error',
    detail: info.nodeMinMet
      ? `${info.nodeVersion} (>= 18 required)`
      : `${info.nodeVersion} — Node >= 18 required`,
    fix: info.nodeMinMet
      ? undefined
      : 'Install Node.js >= 18 via https://nodejs.org or nvm',
    fixable: false,
  });

  checks.push({
    id: 'node.npm',
    label: 'npm',
    severity: info.npmVersion !== 'unknown' ? 'ok' : 'warn',
    detail: info.npmVersion !== 'unknown' ? `npm ${info.npmVersion}` : 'npm not found in PATH',
    fixable: false,
  });

  if (info.nvmActive) {
    const versionMatch =
      !info.nvmCurrentVersion ||
      info.nvmCurrentVersion === info.nodeVersion ||
      parseMinVersion(info.nvmCurrentVersion);
    checks.push({
      id: 'node.nvm',
      label: 'nvm',
      severity: versionMatch ? 'ok' : 'warn',
      detail: info.nvmCurrentVersion
        ? `nvm active, default alias: ${info.nvmCurrentVersion}`
        : 'nvm active',
      fix: versionMatch
        ? undefined
        : 'Run: nvm use default, or nvm alias default <version>',
      fixable: false,
    });
  }

  if (!info.pathContainsNvm && info.nvmActive) {
    checks.push({
      id: 'node.path',
      label: 'PATH contains nvm shims',
      severity: 'warn',
      detail: 'NVM_DIR is set but PATH does not contain nvm shims — Claude Code subprocess may use system Node',
      fix: 'Curato will add the nvm node bin path to env.PATH in ~/.claude/settings.json',
      fixable: true,
    });
  }

  return checks;
}

export function buildUserChecks(): CheckResult[] {
  const info = scanUserSetup();
  const checks: CheckResult[] = [];

  checks.push({
    id: 'user.settings',
    label: 'settings.json',
    severity: info.settingsJsonExists ? 'ok' : 'missing',
    detail: info.settingsJsonExists
      ? info.settingsJsonPath
      : `Not found at ${info.settingsJsonPath}`,
    fix: info.settingsJsonExists
      ? undefined
      : 'Create ~/.claude/settings.json with {"permissions":{"allow":[]}}',
    fixable: !info.settingsJsonExists,
  });

  checks.push({
    id: 'user.claude-md',
    label: 'User CLAUDE.md',
    severity: info.claudeMdExists ? 'ok' : 'warn',
    detail: info.claudeMdExists
      ? info.claudeMdPath
      : 'No user-level CLAUDE.md — global Claude instructions not configured',
    fix: info.claudeMdExists ? undefined : 'Create ~/.claude/CLAUDE.md with global instructions',
    fixable: !info.claudeMdExists,
  });

  checks.push({
    id: 'user.plugins-dir',
    label: 'Plugins directory',
    severity: info.pluginsDirExists ? 'ok' : 'warn',
    detail: info.pluginsDirExists ? info.pluginsDir : `Plugins dir not found at ${info.pluginsDir}`,
    fixable: false,
  });

  return checks;
}

export function buildProjectChecks(cwd: string): CheckResult[] {
  const layout = scanProjectLayout(cwd);
  const checks: CheckResult[] = [];

  checks.push({
    id: 'project.claude-dir',
    label: '.claude/ directory',
    severity: layout.hasClaudeDir ? 'ok' : 'missing',
    detail: layout.hasClaudeDir
      ? `${cwd}/.claude/`
      : 'No .claude/ directory — project Claude setup not initialized',
    fix: layout.hasClaudeDir ? undefined : 'Run /bootstrap-project to scaffold .claude/',
    fixable: !layout.hasClaudeDir,
  });

  checks.push({
    id: 'project.claude-md',
    label: 'Project CLAUDE.md',
    severity: layout.hasClaudeMd ? 'ok' : 'missing',
    detail: layout.hasClaudeMd
      ? `${cwd}/CLAUDE.md`
      : 'No CLAUDE.md — project context not configured for Claude Code',
    fix: layout.hasClaudeMd ? undefined : 'Run /bootstrap-project to create CLAUDE.md',
    fixable: !layout.hasClaudeMd,
  });

  checks.push({
    id: 'project.mcp-json',
    label: '.mcp.json',
    severity: layout.hasMcpJson ? 'ok' : 'warn',
    detail: layout.hasMcpJson
      ? `${cwd}/.mcp.json`
      : 'No .mcp.json — project-scoped MCP servers not configured',
    fix: layout.hasMcpJson ? undefined : 'Create .mcp.json or use /bootstrap-project',
    fixable: false,
  });

  if (existsSync(join(cwd, 'curato-setup.json'))) {
    checks.push({
      id: 'project.team-setup',
      label: 'Team setup',
      severity: 'warn',
      detail: 'curato-setup.json found — run /setup-team to apply team standard',
      fix: 'Run /setup-team',
      fixable: false,
    });
  }

  return checks;
}

export function buildPluginChecks(): CheckResult[] {
  const plugins = scanPluginState();
  const checks: CheckResult[] = [];

  const curatoPlugin = plugins.find((p) => p.name === 'curato');
  checks.push({
    id: 'plugin.curato',
    label: 'curato plugin',
    severity: curatoPlugin
      ? curatoPlugin.valid
        ? 'ok'
        : 'warn'
      : 'missing',
    detail: curatoPlugin
      ? curatoPlugin.valid
        ? `Installed v${curatoPlugin.version ?? 'unknown'}`
        : `Installed but has issues: ${curatoPlugin.issues.join(', ')}`
      : 'curato plugin not installed — run: node scripts/install.js',
    fix: curatoPlugin ? undefined : 'Run: node scripts/install.js',
    fixable: false,
  });

  const invalid = plugins.filter((p) => !p.valid && p.name !== 'curato');
  if (invalid.length > 0) {
    checks.push({
      id: 'plugin.invalid',
      label: 'Plugin integrity',
      severity: 'warn',
      detail: `${invalid.length} plugin(s) have issues: ${invalid.map((p) => p.name).join(', ')}`,
      fixable: false,
    });
  } else if (plugins.length > 0) {
    checks.push({
      id: 'plugin.integrity',
      label: 'Plugin integrity',
      severity: 'ok',
      detail: `${plugins.length} plugin(s) valid`,
      fixable: false,
    });
  }

  return checks;
}

const NVM_RELATIVE_COMMANDS = new Set(['node', 'npx', 'npm']);

function isNvmRelativeCommand(command: string | undefined): boolean {
  if (!command) return false;
  if (isAbsolute(command)) return false; // already absolute
  const base = basename(command);
  return NVM_RELATIVE_COMMANDS.has(base);
}

/**
 * Run `claude mcp list` and return a map of server name → connected status.
 * Returns null if the command fails or times out.
 */
function getCliMcpStatus(): Map<string, boolean> | null {
  const result = spawnSync(claudeBin(), ['mcp', 'list'], {
    encoding: 'utf8',
    timeout: 8000,
  });
  if (result.status !== 0 || !result.stdout) return null;
  const statusMap = new Map<string, boolean>();
  for (const line of result.stdout.split('\n')) {
    // Format: "name: command args - ✓ Connected" or "name: ... - ✗ Failed"
    const match = line.match(/^(\S+):\s+.+?-\s+(.+)$/);
    if (!match) continue;
    const [, name, status] = match;
    if (name && status) {
      statusMap.set(name, status.includes('Connected'));
    }
  }
  return statusMap;
}

export function buildMcpChecks(cwd: string): CheckResult[] {
  const entries = scanMcpRegistry(cwd);
  const checks: CheckResult[] = [];
  const nvmActive = (process.env['NVM_DIR'] ?? '') !== '';

  if (entries.length === 0) {
    checks.push({
      id: 'mcp.none',
      label: 'MCP servers',
      severity: 'warn',
      detail: 'No MCP servers registered in project or global scope',
      fix: 'Add MCP server entries to .mcp.json or ~/.claude/settings.json',
      fixable: false,
    });
    return checks;
  }

  const curatoEntry = entries.find((e) => e.name === 'curato');
  checks.push({
    id: 'mcp.curato',
    label: 'curato MCP',
    severity: curatoEntry
      ? curatoEntry.binaryResolvable
        ? 'ok'
        : 'error'
      : 'missing',
    detail: curatoEntry
      ? curatoEntry.binaryResolvable
        ? `Registered (${curatoEntry.registeredIn}), binary OK at ${curatoEntry.binaryPath}`
        : `Registered but binary not found: ${curatoEntry.command}`
      : 'curato MCP server not registered — run: node scripts/install.js',
    fix: curatoEntry
      ? curatoEntry.binaryResolvable
        ? undefined
        : 'Run: cd mcp-server && npm run build, then node scripts/install.js'
      : 'Run: node scripts/install.js',
    fixable: false,
  });

  const broken = entries.filter(
    (e) => e.type === 'stdio' && !e.binaryResolvable && e.name !== 'curato',
  );
  for (const e of broken) {
    checks.push({
      id: `mcp.broken.${e.name}`,
      label: `MCP: ${e.name}`,
      severity: 'error',
      detail: `Binary not resolvable: ${e.command ?? 'no command'}`,
      fix: `Check that ${e.command} is installed and in PATH`,
      fixable: false,
    });
  }

  // Warn about bare node/npx commands when nvm is active — Claude Code spawns
  // MCP servers with a stripped PATH that doesn't include nvm shims, so the
  // wrong (or missing) Node version will be used at runtime.
  if (nvmActive) {
    const nvmUnsafe = entries.filter(
      (e) => e.type === 'stdio' && e.binaryResolvable && isNvmRelativeCommand(e.command),
    );
    for (const e of nvmUnsafe) {
      checks.push({
        id: `mcp.nvm-unsafe.${e.name}`,
        label: `MCP: ${e.name} (nvm PATH risk)`,
        severity: 'warn',
        detail: `"${e.command}" is a bare command — Claude Code subprocesses use a stripped PATH and may not find the nvm-managed node`,
        fix: `Replace command with absolute path: ${e.binaryPath ?? `$(which ${e.command})`}`,
        fixable: !!e.binaryPath,
      });
    }
  }

  // Detect registry gap: server in CLI (~/.claude.json) but not in VS Code settings.json
  const cliEntries = entries.filter((e) => e.source === 'cli' && e.name !== 'curato');
  const vscodeNames = new Set(entries.filter((e) => e.source === 'vscode').map((e) => e.name));
  for (const e of cliEntries) {
    if (!vscodeNames.has(e.name) && e.binaryResolvable) {
      checks.push({
        id: `mcp.gap-vscode.${e.name}`,
        label: `MCP: ${e.name} (missing from VS Code)`,
        severity: 'warn',
        detail: `"${e.name}" is registered in the CLI (~/.claude.json) but not in VS Code (~/.claude/settings.json) — it won't work in the VS Code extension`,
        fix: `Add "${e.name}" to ~/.claude/settings.json mcpServers`,
        fixable: true,
      });
    }
  }

  // Detect registry gap: server in VS Code settings.json but not in CLI ~/.claude.json
  const cliNames = new Set(entries.filter((e) => e.source === 'cli').map((e) => e.name));
  const vscodeEntries = entries.filter((e) => e.source === 'vscode' && e.name !== 'curato');
  for (const e of vscodeEntries) {
    if (!cliNames.has(e.name) && e.binaryResolvable) {
      checks.push({
        id: `mcp.gap-cli.${e.name}`,
        label: `MCP: ${e.name} (missing from CLI)`,
        severity: 'warn',
        detail: `"${e.name}" is in VS Code settings but not registered with the CLI — it won't work in terminal \`claude\` sessions`,
        fix: `Run: claude mcp add -s user ${e.name} -- ${e.command} ${(e.args ?? []).join(' ')}`,
        fixable: true,
      });
    }
  }

  // Live reachability check: registered + binary OK but not connecting
  const cliStatus = getCliMcpStatus();
  if (cliStatus !== null) {
    const unreachable = entries.filter(
      (e) =>
        e.type === 'stdio' &&
        e.binaryResolvable &&
        e.name !== 'curato' &&
        cliStatus.has(e.name) &&
        !cliStatus.get(e.name),
    );
    for (const e of unreachable) {
      const isAzureDevOps = (e.args ?? []).some((a) => a.includes('@azure-devops/mcp'));
      const detail = isAzureDevOps
        ? `"${e.name}" is registered but not connecting — run /connect-azure to authenticate`
        : `"${e.name}" is registered and binary is found, but failed to connect — check server logs or dependencies`;
      const fix = isAzureDevOps
        ? 'Run /connect-azure to complete browser authentication'
        : `Run manually to see errors: ${e.command ?? e.name} ${(e.args ?? []).join(' ')}`;
      checks.push({
        id: `mcp.unreachable.${e.name}`,
        label: `MCP: ${e.name} (not connecting)`,
        severity: 'warn',
        detail,
        fix,
        fixable: false,
      });
    }
  }

  const healthy = entries.filter(
    (e) => e.binaryResolvable && e.name !== 'curato',
  );
  if (healthy.length > 0) {
    checks.push({
      id: 'mcp.others-ok',
      label: 'Other MCP servers',
      severity: 'ok',
      detail: `${healthy.length} other server(s) OK: ${healthy.map((e) => e.name).join(', ')}`,
      fixable: false,
    });
  }

  return checks;
}

function summarize(checks: CheckResult[]) {
  return checks.reduce(
    (acc, c) => {
      acc[c.severity]++;
      return acc;
    },
    { ok: 0, warn: 0, error: 0, missing: 0 },
  );
}

register(
  {
    name: 'scan_environment',
    description:
      'Full environment scan. Checks Node runtime, user Claude setup, project layout, plugins, and MCP registrations. Returns a ScanReport.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: 'Working directory to scan (defaults to process.cwd())',
        },
        scope: {
          type: 'string',
          enum: ['user', 'project', 'full'],
          description: 'Scope of the scan',
        },
      },
    },
  },
  async (args) => {
    const { cwd = process.cwd(), scope = 'full' } = (args as ScanEnvironmentParams) ?? {};

    const checks: CheckResult[] = [];

    if (scope === 'full' || scope === 'user') {
      checks.push(...buildNodeChecks());
      checks.push(...buildUserChecks());
      checks.push(...buildPluginChecks());
      checks.push(...buildMcpChecks(cwd));
    }
    if (scope === 'full' || scope === 'project') {
      checks.push(...buildProjectChecks(cwd));
      if (scope === 'project') {
        checks.push(...buildMcpChecks(cwd));
      }
    }

    const report: ScanReport = {
      timestamp: new Date().toISOString(),
      scope,
      persona: 'Curato',
      checks,
      summary: summarize(checks),
    };

    return toolResult(report);
  },
);

register(
  {
    name: 'check_node_runtime',
    description:
      'Check Node.js version, PATH, and nvm configuration. Returns NodeRuntimeInfo.',
    inputSchema: { type: 'object', properties: {} },
  },
  async (_args) => {
    return toolResult(scanNodeRuntime());
  },
);

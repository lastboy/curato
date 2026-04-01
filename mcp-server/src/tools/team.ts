import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { claudeBin } from '../utils/platform.js';
import { register } from './index.js';
import { toolResult } from '../types.js';
import type { RepairProposal, RepairReport, ApplyTeamSetupParams, TeamSetupConfig, TeamMcpEntry, TeamPluginEntry } from '../types.js';
import { readTeamConfig, validateTeamConfig } from '../scanner/team-config.js';
import { applySkillFilter, reportSkillCosts } from '../patcher/skill-filter.js';
import type { SkillFilterReport } from '../patcher/skill-filter.js';
import { safeMerge } from '../patcher/json-merger.js';
import { backupFile } from '../patcher/backup.js';
import { registerMcpServer } from '../patcher/mcp-registrar.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function readJson(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function writeJson(filePath: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function resolvePluginName(entry: string | TeamPluginEntry): string {
  return typeof entry === 'string' ? entry : entry.name;
}

function getInstalledPlugins(): Set<string> {
  const result = spawnSync(claudeBin(), ['plugin', 'list', '--json'], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) return new Set();
  try {
    const parsed = JSON.parse(result.stdout) as unknown;
    if (typeof parsed !== 'object' || !parsed || Array.isArray(parsed)) return new Set();
    const obj = parsed as Record<string, unknown>;
    // format: { installed: [{ name, ... }], available: [...] }
    const installed = Array.isArray(obj['installed']) ? obj['installed'] as Array<Record<string, unknown>> : [];
    return new Set(installed.map((p) => String(p['name'] ?? '')).filter(Boolean));
  } catch {
    return new Set();
  }
}

// ── Proposal builder ───────────────────────────────────────────────────────────

function buildProposals(config: TeamSetupConfig, cwd: string): RepairProposal[] {
  const proposals: RepairProposal[] = [];
  const userHome = homedir();

  // MCP servers
  if (config.mcpServers) {
    for (const [name, entry] of Object.entries(config.mcpServers) as [string, TeamMcpEntry][]) {
      if (entry.enabled === false) continue;  // skip disabled entries without removing
      if (entry.scope === 'project') {
        const mcpJsonPath = join(cwd, '.mcp.json');
        const existing = readJson(mcpJsonPath);
        const existingServers = (existing['mcpServers'] as Record<string, unknown>) ?? {};
        if (name in existingServers) continue; // already present
        const proposed = safeMerge(existing, {
          mcpServers: { [name]: { command: entry.command, args: entry.args, env: entry.env } },
        });
        proposals.push({
          check: {
            id: `team.mcp.${name}`,
            label: `MCP: ${name}`,
            severity: 'missing',
            detail: `Team MCP server "${name}" not in .mcp.json`,
            fixable: true,
          },
          action: 'merge',
          targetPath: mcpJsonPath,
          before: JSON.stringify(existing, null, 2),
          after: JSON.stringify(proposed, null, 2),
        });
      } else {
        // user scope → must be in BOTH registries
        const settingsPath = join(userHome, '.claude', 'settings.json');
        const claudeJsonPath = join(userHome, '.claude.json');

        const vsCodeSettings = readJson(settingsPath);
        const vsCodeServers = (vsCodeSettings['mcpServers'] as Record<string, unknown>) ?? {};
        const inVsCode = name in vsCodeServers;

        const cliSettings = readJson(claudeJsonPath);
        const cliServers = (cliSettings['mcpServers'] as Record<string, unknown>) ?? {};
        const inCli = name in cliServers;

        if (inVsCode && inCli) continue; // already in both — nothing to do

        const missing = [!inVsCode && '~/.claude/settings.json', !inCli && '~/.claude.json']
          .filter(Boolean).join(' and ');
        const entryObj = {
          command: entry.command,
          ...(entry.args ? { args: entry.args } : {}),
          ...(entry.env ? { env: entry.env } : {}),
        };
        proposals.push({
          check: {
            id: `team.mcp.${name}`,
            label: `MCP: ${name} (user)`,
            severity: 'missing',
            detail: `Team MCP server "${name}" not registered in ${missing}`,
            fixable: true,
          },
          action: 'register-mcp',
          targetPath: settingsPath,
          after: JSON.stringify(entryObj),
        });
      }
    }
  }

  // Plugins — only propose missing ones
  if (config.plugins && config.plugins.length > 0) {
    const installed = getInstalledPlugins();
    for (const pluginEntry of config.plugins) {
      if (typeof pluginEntry !== 'string' && pluginEntry.enabled === false) continue;  // skip disabled entries without removing
      const pluginName = resolvePluginName(pluginEntry);
      if (installed.has(pluginName)) continue;
      proposals.push({
        check: {
          id: `team.plugin.${pluginName}`,
          label: `Plugin: ${pluginName}`,
          severity: 'missing',
          detail: `Team plugin "${pluginName}" not installed`,
          fixable: true,
        },
        action: 'run-command',
        targetPath: `plugin:${pluginName}`,
        command: [claudeBin(), 'plugin', 'install', pluginName],
        after: `claude plugin install ${pluginName}`,
      });
    }
  }

  // CLAUDE.md — project scope
  if (config.claudeMd?.project) {
    const entry = config.claudeMd.project;
    const targetPath = join(cwd, 'CLAUDE.md');
    if (entry.mode === 'create-if-missing' && existsSync(targetPath)) {
      // already exists — skip
    } else {
      const before = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : undefined;
      let after = entry.content;
      if (entry.mode === 'append-if-missing-section' && before) {
        const section = entry.section ?? '';
        after = before.includes(section) ? before : before + '\n\n' + entry.content;
      }
      proposals.push({
        check: {
          id: 'team.claude-md.project',
          label: 'Project CLAUDE.md',
          severity: before ? 'warn' : 'missing',
          detail: before
            ? `Project CLAUDE.md exists but team section may be missing`
            : 'Project CLAUDE.md not found',
          fixable: true,
        },
        action: entry.mode === 'create-if-missing' ? 'create-if-missing' : 'append',
        targetPath,
        before,
        after,
      });
    }
  }

  // CLAUDE.md — user scope
  if (config.claudeMd?.user) {
    const entry = config.claudeMd.user;
    const targetPath = join(userHome, '.claude', 'CLAUDE.md');
    const before = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : undefined;

    if (entry.mode === 'append-if-missing-section') {
      const section = entry.section ?? entry.content.split('\n')[0] ?? '';
      if (before?.includes(section)) {
        // section already present — skip
      } else {
        const after = before ? before + '\n\n' + entry.content : entry.content;
        proposals.push({
          check: {
            id: 'team.claude-md.user',
            label: 'User CLAUDE.md (team section)',
            severity: 'missing',
            detail: `Team section "${section}" not in ~/.claude/CLAUDE.md`,
            fixable: true,
          },
          action: 'append',
          targetPath,
          before,
          after,
        });
      }
    } else if (entry.mode === 'create-if-missing' && !before) {
      proposals.push({
        check: {
          id: 'team.claude-md.user',
          label: 'User CLAUDE.md',
          severity: 'missing',
          detail: '~/.claude/CLAUDE.md not found',
          fixable: true,
        },
        action: 'create-if-missing',
        targetPath,
        after: entry.content,
      });
    }
  }

  return proposals;
}

// ── Apply proposals ────────────────────────────────────────────────────────────

function applyProposals(proposals: RepairProposal[]): { applied: RepairProposal[]; backupDirs: string[] } {
  const applied: RepairProposal[] = [];
  const backupDirs: string[] = [];

  for (const proposal of proposals) {
    if (proposal.action === 'run-command') {
      if (!proposal.command) continue;
      const result = spawnSync(proposal.command[0] ?? '', proposal.command.slice(1), { encoding: 'utf8' });
      if (result.status === 0) applied.push(proposal);
      continue;
    }

    // User-scope MCP: write to both VS Code and CLI registries
    if (proposal.action === 'register-mcp' && proposal.check.id.startsWith('team.mcp.')) {
      const serverName = proposal.check.id.replace('team.mcp.', '');
      try {
        const entry = JSON.parse(proposal.after) as { command: string; args?: string[]; env?: Record<string, string> };

        // VS Code registry: ~/.claude/settings.json
        const vsResult = registerMcpServer({ serverName, entry, dryRun: false, settingsPath: proposal.targetPath });
        if (vsResult.backupDir) backupDirs.push(vsResult.backupDir);

        // CLI registry: ~/.claude.json
        const claudeJsonPath = join(homedir(), '.claude.json');
        const claudeJson = readJson(claudeJsonPath);
        const cliServers = (claudeJson['mcpServers'] as Record<string, unknown>) ?? {};
        if (!(serverName in cliServers)) {
          const cliBackup = backupFile(claudeJsonPath);
          if (cliBackup) backupDirs.push(cliBackup);
          const updated = safeMerge(claudeJson, { mcpServers: { [serverName]: entry } });
          writeJson(claudeJsonPath, updated);
        }

        applied.push(proposal);
      } catch { /* skip on parse error */ }
      continue;
    }

    const filePath = proposal.targetPath;

    if (proposal.action === 'create-if-missing' && existsSync(filePath)) {
      continue; // skip — already exists
    }

    // Backup before write
    if (existsSync(filePath)) {
      const bd = backupFile(filePath);
      if (bd) backupDirs.push(bd);
    }

    // Write
    if (proposal.action === 'merge') {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, proposal.after + '\n', 'utf8');
    } else if (proposal.action === 'append') {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, proposal.after, 'utf8');
    } else {
      // create-if-missing / overwrite
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, proposal.after, 'utf8');
    }

    applied.push(proposal);
  }

  return { applied, backupDirs };
}

// ── Tool registration ──────────────────────────────────────────────────────────

register(
  {
    name: 'apply_team_setup',
    description:
      'Apply team/company Claude Code setup from curato-setup.json. Installs MCP servers at the correct scope, installs plugins, and scaffolds CLAUDE.md content. Supports an "extends" field to inherit from a shared GitHub repo.',
    inputSchema: {
      type: 'object',
      required: ['dryRun'],
      properties: {
        configPath: {
          type: 'string',
          description: 'Path to curato-setup.json (defaults to ./curato-setup.json)',
        },
        cwd: {
          type: 'string',
          description: 'Working directory (defaults to process.cwd())',
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, return proposals without modifying any files',
        },
      },
    },
  },
  async (args) => {
    const params = args as ApplyTeamSetupParams;
    const cwd = params.cwd ?? process.cwd();

    const config = await readTeamConfig(cwd);

    if (!config) {
      const report: RepairReport = {
        dryRun: params.dryRun,
        proposals: [],
        applied: [],
      };
      return toolResult({ ...report, message: 'No curato-setup.json found. Create one to define your team standard.' });
    }

    const validation = validateTeamConfig(config);
    if (!validation.valid) {
      return toolResult({ error: 'Invalid curato-setup.json', errors: validation.errors });
    }

    const proposals = buildProposals(config, cwd);
    const slim = (ps: RepairProposal[]) => ps.map(({ before: _b, after: _a, ...rest }) => rest);

    // Collect plugins that have skill config
    const pluginsWithSkills = (config.plugins ?? [])
      .filter((p): p is import('../types.js').TeamPluginEntry =>
        typeof p !== 'string' && !!p.skills,
      );

    if (params.dryRun) {
      // Report skill costs without applying
      const skillReports: SkillFilterReport[] = pluginsWithSkills.map((p) =>
        reportSkillCosts(p.name, p.skills),
      );
      const report = { dryRun: true, proposals: slim(proposals), applied: [], skillReports };
      return toolResult(report);
    }

    const { applied, backupDirs } = applyProposals(proposals);
    const backupDir = backupDirs[0];

    // Apply skill filters after plugin installs
    const skillReports: SkillFilterReport[] = pluginsWithSkills.map((p) =>
      applySkillFilter(p.name, p.skills!, false),
    );

    const report = { dryRun: false, proposals: slim(proposals), applied: slim(applied), backupDir, skillReports };
    return toolResult(report);
  },
);

// Keep writeJson in scope (used indirectly via writeFileSync calls above, but
// exported here so tests can import without side effects if needed)
export { readJson as _readJson, writeJson as _writeJson };

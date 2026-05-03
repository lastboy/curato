import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readTeamConfig, validateTeamConfig } from '../../scanner/team-config.js';
import { removeMcpServer } from '../../patcher/mcp-remover.js';
import { uninstallShellEnv, readInstalledVars } from '../../patcher/shell-env.js';
import { claudeBin } from '../../utils/platform.js';
import { ok, fail, info, warn, bold, dim, line } from '../print.js';
const HELP = `
USAGE
  curato teardown [options]

OPTIONS
  --config <path>   Path to curato-setup.json (default: ./curato-setup.json)
  --dry-run         Preview removals without applying
  --help            Show this help

DESCRIPTION
  Reverses what \`curato setup\` applied from the same config file.
  Runs sections in the reverse order of install:

    1. Plugins         → claude plugin uninstall <name>
    2. MCP servers     → remove from all registries
    3. Marketplaces    → claude plugin marketplace remove <name>
    4. Shell env       → remove LaunchAgent, unset launchd vars
    5. CLAUDE.md       → skipped (text appends are not safely reversible)

  Entries with enabled:false are still torn down (if they exist on disk),
  since setup may have registered them in earlier runs.

EXAMPLES
  curato teardown
  curato teardown --config ./team/curato-setup.json
  curato teardown --dry-run
`;
export async function teardown(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            config: { type: 'string' },
            'dry-run': { type: 'boolean', default: false },
            help: { type: 'boolean', default: false },
        },
        allowPositionals: false,
    });
    if (values.help) {
        console.log(HELP);
        return;
    }
    const dryRun = values['dry-run'];
    const configPath = values.config;
    const cwd = configPath ? dirname(configPath) : process.cwd();
    if (dryRun)
        dim('dry-run mode — no files will be changed');
    const config = configPath
        ? (() => { try {
            return JSON.parse(readFileSync(configPath, 'utf8'));
        }
        catch {
            return null;
        } })()
        : await readTeamConfig(cwd);
    if (!config) {
        fail(`No curato-setup.json found${configPath ? ` at ${configPath}` : ' in current directory'}`);
        process.exit(1);
    }
    const validation = validateTeamConfig(config);
    if (!validation.valid) {
        fail('Invalid curato-setup.json:');
        for (const e of validation.errors)
            console.error(`  • ${e}`);
        process.exit(1);
    }
    const cfg = config;
    let didWork = false;
    // ── Plugins (reverse of setup order) ─────────────────────────────────────────
    if (cfg.plugins && cfg.plugins.length > 0) {
        bold('\nPlugins');
        for (const pluginEntry of cfg.plugins) {
            const name = typeof pluginEntry === 'string' ? pluginEntry : pluginEntry.name;
            didWork = true;
            if (dryRun) {
                info(`  would uninstall: ${name}`);
                continue;
            }
            info(`  uninstalling: ${name}`);
            const r = spawnSync(claudeBin(), ['plugin', 'uninstall', name], {
                encoding: 'utf8',
                stdio: 'inherit',
            });
            if (r.status === 0)
                ok(`  uninstalled: ${name}`);
            else
                warn(`  may not have been installed: ${name}`);
        }
    }
    // ── MCP servers ──────────────────────────────────────────────────────────────
    if (cfg.mcpServers && Object.keys(cfg.mcpServers).length > 0) {
        bold('\nMCP Servers');
        for (const [name] of Object.entries(cfg.mcpServers)) {
            didWork = true;
            if (dryRun) {
                info(`  would remove: ${name}`);
                continue;
            }
            const result = removeMcpServer({ serverName: name, dryRun: false, cwd });
            if (result.removedFrom.length > 0) {
                ok(`  removed ${name} from: ${result.removedFrom.join(', ')}`);
            }
            else {
                dim(`  not found (already gone): ${name}`);
            }
        }
    }
    // ── Marketplaces ─────────────────────────────────────────────────────────────
    if (cfg.marketplaces && Object.keys(cfg.marketplaces).length > 0) {
        bold('\nMarketplaces');
        for (const [name] of Object.entries(cfg.marketplaces)) {
            didWork = true;
            if (dryRun) {
                info(`  would remove marketplace: ${name}`);
                continue;
            }
            info(`  removing marketplace: ${name}`);
            const r = spawnSync(claudeBin(), ['plugin', 'marketplace', 'remove', name], {
                encoding: 'utf8',
                stdio: 'inherit',
            });
            if (r.status === 0)
                ok(`  removed marketplace: ${name}`);
            else
                warn(`  may not have been registered: ${name}`);
        }
    }
    // ── Shell env (LaunchAgent) ──────────────────────────────────────────────────
    if (cfg.shellEnv && cfg.shellEnv.vars.length > 0) {
        bold('\nShell Env (LaunchAgent)');
        if (process.platform !== 'darwin') {
            dim(`  not macOS — nothing to remove`);
        }
        else {
            didWork = true;
            if (dryRun) {
                info(`  would remove LaunchAgent and unset: ${cfg.shellEnv.vars.join(', ')}`);
            }
            else {
                const installedVars = readInstalledVars();
                const varsToUnset = installedVars.length > 0 ? installedVars : cfg.shellEnv.vars;
                const result = uninstallShellEnv({ dryRun: false, varsToUnset });
                if (result.existed)
                    ok(`  removed LaunchAgent: ${result.plistPath}`);
                else
                    dim(`  no LaunchAgent found (already removed)`);
                if (result.unsetVars.length > 0)
                    dim(`  unset: ${result.unsetVars.join(', ')}`);
            }
        }
    }
    // ── CLAUDE.md — skipped (not safely reversible) ──────────────────────────────
    if (cfg.claudeMd && (cfg.claudeMd.project || cfg.claudeMd.user)) {
        bold('\nCLAUDE.md');
        warn('  claudeMd teardown is not supported — text appends cannot be reliably reverted.');
        dim('  Revert manually if needed. Backups from the original setup are in ~/.curato-backups/.');
    }
    line();
    if (!didWork && !cfg.claudeMd) {
        ok('Nothing in the config to tear down.');
    }
    else if (dryRun) {
        info('dry-run complete — run without --dry-run to apply.');
    }
    else {
        ok('Teardown complete. Reload Claude Code to pick up changes.');
    }
}
//# sourceMappingURL=teardown.js.map
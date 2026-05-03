import { parseArgs } from 'node:util';
import { scanNodeRuntime } from '../../scanner/node-runtime.js';
import { scanUserSetup } from '../../scanner/claude-config.js';
import { scanPluginState } from '../../scanner/plugin-state.js';
import { scanMcpRegistry } from '../../scanner/mcp-registry.js';
import { scanProjectLayout } from '../../scanner/project-layout.js';
import { ok, warn, fail, bold, dim, line } from '../print.js';
const HELP = `
USAGE
  curato scan [options]

OPTIONS
  --json    Output raw JSON (machine-readable)
  --help    Show this help
`;
function printCheck(c) {
    const icon = { ok: '✓', warn: '⚠', error: '✗', missing: '○' }[c.status];
    const printer = { ok, warn, error: fail, missing: dim }[c.status];
    printer(`${icon}  ${c.label.padEnd(32)} ${c.detail ?? ''}`);
}
export async function scan(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            json: { type: 'boolean', default: false },
            help: { type: 'boolean', default: false },
        },
        allowPositionals: false,
    });
    if (values.help) {
        console.log(HELP);
        return;
    }
    const cwd = process.cwd();
    const checks = [];
    // Node runtime
    const node = scanNodeRuntime();
    checks.push({
        id: 'node-runtime',
        label: 'Node.js runtime',
        status: node.nodeMinMet ? 'ok' : 'error',
        detail: node.nodeVersion || 'not found',
    });
    // Claude user setup
    const user = scanUserSetup();
    checks.push({
        id: 'claude-settings',
        label: 'Claude settings.json',
        status: user.settingsJsonExists ? 'ok' : 'missing',
        detail: user.settingsJsonExists ? user.settingsJsonPath : 'not found',
    });
    checks.push({
        id: 'claude-md-user',
        label: 'User CLAUDE.md',
        status: user.claudeMdExists ? 'ok' : 'missing',
        detail: user.claudeMdExists ? user.claudeMdPath ?? '' : 'not found',
    });
    // MCP servers
    const mcpServers = scanMcpRegistry(cwd);
    checks.push({
        id: 'mcp-servers',
        label: 'MCP servers registered',
        status: mcpServers.length > 0 ? 'ok' : 'missing',
        detail: mcpServers.length > 0
            ? mcpServers.map((s) => s.name).join(', ')
            : 'none registered',
    });
    // Plugins
    const plugins = scanPluginState();
    checks.push({
        id: 'plugins',
        label: 'Plugins installed',
        status: plugins.length > 0 ? 'ok' : 'missing',
        detail: plugins.length > 0
            ? plugins.map((p) => p.name).join(', ')
            : 'none installed',
    });
    // Project layout
    const project = scanProjectLayout(cwd);
    checks.push({
        id: 'project-claude-dir',
        label: 'Project .claude/ dir',
        status: project.hasClaudeDir ? 'ok' : 'missing',
        detail: project.hasClaudeDir ? `.claude/` : 'not found (use /bootstrap-project in Claude Code)',
    });
    if (values.json) {
        const counts = { ok: 0, warn: 0, error: 0, missing: 0 };
        for (const c of checks)
            counts[c.status]++;
        console.log(JSON.stringify({ checks, counts }, null, 2));
        return;
    }
    bold('\nCurato — environment scan\n');
    for (const c of checks)
        printCheck(c);
    line();
    const counts = { ok: 0, warn: 0, error: 0, missing: 0 };
    for (const c of checks)
        counts[c.status]++;
    const parts = [];
    if (counts.ok)
        parts.push(`${counts.ok} ok`);
    if (counts.warn)
        parts.push(`${counts.warn} warn`);
    if (counts.error)
        parts.push(`${counts.error} error`);
    if (counts.missing)
        parts.push(`${counts.missing} missing`);
    const allOk = counts.error === 0 && counts.warn === 0 && counts.missing === 0;
    if (allOk)
        ok(parts.join(', '));
    else
        warn(parts.join(', '));
}
//# sourceMappingURL=scan.js.map
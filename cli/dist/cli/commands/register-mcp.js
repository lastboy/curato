import { parseArgs } from 'node:util';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { registerMcpServer } from '../../patcher/mcp-registrar.js';
import { safeMerge } from '../../patcher/json-merger.js';
import { backupFile } from '../../patcher/backup.js';
import { getClaudeDir, getClaudeJsonPath } from '../../utils/platform.js';
import { ok, fail, info, dim } from '../print.js';
const HELP = `
USAGE
  curato register-mcp <name> <command> [options]

OPTIONS
  --args <a,b,c>     Comma-separated CLI arguments for the server
  --env KEY=VAL      Environment variable (repeatable)
  --scope            user (default) or project
  --dry-run          Preview without applying
  --help             Show this help

EXAMPLES
  curato register-mcp azure-devops npx \\
    --args "-y,@azure-devops/mcp,MyOrg,-d,repositories,work-items,--authentication,envvar" \\
    --env ADO_MCP_AUTH_TOKEN=mytoken

  curato register-mcp my-server node \\
    --args "/path/to/server.js" \\
    --scope project
`;
export async function registerMcp(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        options: {
            args: { type: 'string' },
            env: { type: 'string', multiple: true },
            scope: { type: 'string', default: 'user' },
            'dry-run': { type: 'boolean', default: false },
            help: { type: 'boolean', default: false },
        },
        allowPositionals: true,
    });
    if (values.help) {
        console.log(HELP);
        return;
    }
    const [name, command] = positionals;
    if (!name || !command) {
        console.error('Error: <name> and <command> are required.\n');
        console.log(HELP);
        process.exit(1);
    }
    const dryRun = values['dry-run'];
    const scope = values.scope;
    const cliArgs = values.args ? values.args.split(',').map((s) => s.trim()) : undefined;
    const env = {};
    for (const pair of (values.env ?? [])) {
        const idx = pair.indexOf('=');
        if (idx < 1) {
            fail(`Invalid --env format: "${pair}" (expected KEY=VALUE)`);
            process.exit(1);
        }
        env[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
    const entry = {
        command,
        ...(cliArgs ? { args: cliArgs } : {}),
        ...(Object.keys(env).length > 0 ? { env } : {}),
    };
    if (dryRun) {
        info(`dry-run: would register "${name}" (scope: ${scope})`);
        dim(JSON.stringify({ [name]: entry }, null, 2));
        return;
    }
    const claudeDir = getClaudeDir();
    if (scope === 'project') {
        const mcpJsonPath = join(process.cwd(), '.mcp.json');
        let existing = {};
        if (existsSync(mcpJsonPath)) {
            try {
                existing = JSON.parse(readFileSync(mcpJsonPath, 'utf8'));
            }
            catch { /* ignore */ }
        }
        const servers = existing['mcpServers'] ?? {};
        if (name in servers) {
            dim(`Already registered in .mcp.json: ${name}`);
            return;
        }
        backupFile(mcpJsonPath);
        const updated = safeMerge(existing, { mcpServers: { [name]: entry } });
        mkdirSync(dirname(mcpJsonPath), { recursive: true });
        writeFileSync(mcpJsonPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
        ok(`Registered in .mcp.json: ${name}`);
        return;
    }
    // user scope — both registries
    const settingsPath = join(claudeDir, 'settings.json');
    const vsResult = registerMcpServer({ serverName: name, entry, dryRun: false, settingsPath });
    const claudeJsonPath = getClaudeJsonPath();
    let cliJson = {};
    if (existsSync(claudeJsonPath)) {
        try {
            cliJson = JSON.parse(readFileSync(claudeJsonPath, 'utf8'));
        }
        catch { /* ignore */ }
    }
    const cliServers = cliJson['mcpServers'] ?? {};
    if (!(name in cliServers)) {
        backupFile(claudeJsonPath);
        const updated = safeMerge(cliJson, { mcpServers: { [name]: entry } });
        mkdirSync(dirname(claudeJsonPath), { recursive: true });
        writeFileSync(claudeJsonPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
    }
    if (vsResult.alreadyPresent) {
        dim(`Already registered: ${name}`);
    }
    else {
        ok(`Registered (user scope): ${name}`);
    }
}
//# sourceMappingURL=register-mcp.js.map
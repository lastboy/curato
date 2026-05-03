import { parseArgs } from 'node:util';
import { ok, dim, info } from '../print.js';
import { removeMcpServer } from '../../patcher/mcp-remover.js';
import { getClaudeDir, getClaudeJsonPath } from '../../utils/platform.js';
import { join } from 'node:path';
const HELP = `
USAGE
  curato remove-mcp <name> [options]

OPTIONS
  --dry-run   Preview without applying
  --help      Show this help

EXAMPLES
  curato remove-mcp azure-devops
  curato remove-mcp my-server --dry-run
`;
export async function removeMcp(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        options: {
            'dry-run': { type: 'boolean', default: false },
            help: { type: 'boolean', default: false },
        },
        allowPositionals: true,
    });
    if (values.help) {
        console.log(HELP);
        return;
    }
    const name = positionals[0];
    if (!name) {
        console.error('Error: server name is required.\n');
        console.log(HELP);
        process.exit(1);
    }
    const dryRun = values['dry-run'];
    const settingsPath = join(getClaudeDir(), 'settings.json');
    const claudeJsonPath = getClaudeJsonPath();
    if (dryRun) {
        info(`dry-run: would remove "${name}" from both registries`);
        return;
    }
    const result = removeMcpServer({
        serverName: name,
        dryRun: false,
        settingsJsonPath: settingsPath,
        claudeJsonPath,
        cwd: process.cwd(),
    });
    if (result.removedFrom.length === 0) {
        dim(`Not found in any registry: ${name}`);
    }
    else {
        ok(`Removed "${name}" from: ${result.removedFrom.join(', ')}`);
    }
}
//# sourceMappingURL=remove-mcp.js.map
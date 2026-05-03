import { parseArgs } from 'node:util';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { getClaudeDir } from '../../utils/platform.js';
import { ok, fail, info, dim } from '../print.js';
const HELP = `
USAGE
  curato clear-cache [options]

OPTIONS
  --plugin <name>       Only clear cache for this plugin
  --marketplace <name>  Only clear cache for this marketplace
  --dry-run             Preview without deleting
  --help                Show this help

EXAMPLES
  curato clear-cache
  curato clear-cache --plugin superpowers
  curato clear-cache --dry-run
`;
export async function clearCache(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            plugin: { type: 'string' },
            marketplace: { type: 'string' },
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
    const cacheRoot = join(getClaudeDir(), 'plugins', 'cache');
    if (!existsSync(cacheRoot)) {
        dim('Cache directory does not exist — nothing to clear.');
        return;
    }
    const targets = [];
    for (const marketplace of readdirSync(cacheRoot, { withFileTypes: true }).filter((d) => d.isDirectory())) {
        if (values.marketplace && marketplace.name !== values.marketplace)
            continue;
        const mDir = join(cacheRoot, marketplace.name);
        for (const plugin of readdirSync(mDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
            if (values.plugin && plugin.name !== values.plugin)
                continue;
            targets.push(join(mDir, plugin.name));
        }
    }
    if (targets.length === 0) {
        dim('Nothing matched — cache is already empty.');
        return;
    }
    if (dryRun) {
        info(`dry-run: would delete ${targets.length} director(ies):`);
        for (const t of targets)
            dim(`  ${t}`);
        return;
    }
    const errors = [];
    for (const t of targets) {
        try {
            rmSync(t, { recursive: true, force: true });
            ok(`Cleared: ${t}`);
        }
        catch (e) {
            fail(`Failed to clear: ${t}`);
            errors.push(e instanceof Error ? e.message : String(e));
        }
    }
    if (errors.length > 0) {
        for (const e of errors)
            fail(`  ${e}`);
        process.exit(1);
    }
}
//# sourceMappingURL=clear-cache.js.map
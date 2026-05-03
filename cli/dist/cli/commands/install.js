import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { applySkillFilter } from '../../patcher/skill-filter.js';
import { claudeBin } from '../../utils/platform.js';
import { ok, fail, info, warn, line } from '../print.js';
const HELP = `
USAGE
  curato install <plugin> [options]

OPTIONS
  --exclude <skills>   Comma-separated skill names to disable
  --include <skills>   Comma-separated skill names to keep enabled (all others disabled)
  --dry-run            Preview without applying
  --help               Show this help

EXAMPLES
  curato install superpowers
  curato install superpowers --exclude writing-skills,subagent-driven-development
  curato install superpowers --include brainstorming,systematic-debugging
`;
export async function install(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        options: {
            exclude: { type: 'string' },
            include: { type: 'string' },
            'dry-run': { type: 'boolean', default: false },
            help: { type: 'boolean', default: false },
        },
        allowPositionals: true,
    });
    if (values.help) {
        console.log(HELP);
        return;
    }
    const pluginName = positionals[0];
    if (!pluginName) {
        console.error('Error: plugin name is required.\n');
        console.log(HELP);
        process.exit(1);
    }
    const dryRun = values['dry-run'];
    const exclude = values.exclude ? values.exclude.split(',').map((s) => s.trim()) : [];
    const include = values.include ? values.include.split(',').map((s) => s.trim()) : [];
    const hasFilter = exclude.length > 0 || include.length > 0;
    if (dryRun) {
        info(`dry-run: would install plugin "${pluginName}"`);
        if (hasFilter)
            info(`dry-run: would apply skill filter  exclude=[${exclude}]  include=[${include}]`);
        return;
    }
    // Step 1: install via claude CLI
    info(`Installing plugin "${pluginName}"...`);
    const result = spawnSync(claudeBin(), ['plugin', 'install', pluginName], {
        encoding: 'utf8',
        stdio: 'inherit',
    });
    if (result.status !== 0) {
        fail(`claude plugin install ${pluginName} failed (exit ${result.status ?? 'unknown'})`);
        process.exit(1);
    }
    ok(`Plugin "${pluginName}" installed`);
    // Step 2: apply skill filter if requested
    if (!hasFilter)
        return;
    line();
    info('Applying skill filter...');
    const report = applySkillFilter(pluginName, { include, exclude }, false);
    if (!report.cachePath) {
        warn(`Could not find plugin cache for "${pluginName}" — skill filter skipped`);
        return;
    }
    const disabled = report.skills.filter((s) => s.status !== 'included');
    const kept = report.skills.filter((s) => s.status === 'included');
    for (const s of disabled)
        ok(`  disabled: ${s.name}`);
    for (const s of kept)
        info(`  kept:     ${s.name}`);
    if (report.unknownSkills.length > 0) {
        warn(`Unknown skills (disabled): ${report.unknownSkills.join(', ')}`);
    }
    line();
    ok(`Skill filter applied — ~${report.startupSavingTokens} startup tokens saved`);
}
//# sourceMappingURL=install.js.map
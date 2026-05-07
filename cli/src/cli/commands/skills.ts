import { parseArgs } from 'node:util';
import { reportSkillCosts } from '../../patcher/skill-filter.js';
import { ok, fail, warn, dim, bold, line, boldStr, dimStr } from '../print.js';

const HELP = `
USAGE
  curato skills <plugin>

OPTIONS
  --help    Show this help

EXAMPLES
  curato skills curato
  curato skills superpowers
`;

export async function skills(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { help: { type: 'boolean', default: false } },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const pluginName = positionals[0]!;
  const report = reportSkillCosts(pluginName);

  if (!report.cachePath) {
    fail(`Plugin "${pluginName}" is not installed (no cache found).`);
    dim(`Run: curato install ${pluginName}`);
    process.exit(1);
  }

  bold(`\nSkills — ${pluginName}`);
  line();

  if (report.skills.length === 0) {
    dim('  No skills found in this plugin.');
    process.exit(0);
  }

  const COL = 36;
  for (const s of report.skills) {
    const tokens = `~${s.estimatedTokens.toLocaleString()} tokens`;
    const label = s.name.padEnd(COL);

    if (s.currentlyDisabled) {
      dim(`  ○  ${label} ${tokens.padStart(14)}   [disabled]`);
    } else {
      ok(`  ${label} ${tokens.padStart(14)}   [enabled]`);
    }
  }

  line();

  const enabledTokens = report.skills
    .filter(s => !s.currentlyDisabled)
    .reduce((sum, s) => sum + s.estimatedTokens, 0);
  const savedTokens = report.skills
    .filter(s => s.currentlyDisabled)
    .reduce((sum, s) => sum + s.estimatedTokens, 0);

  console.log(`  ${boldStr('Loaded into context:')}  ~${enabledTokens.toLocaleString()} tokens`);
  if (savedTokens > 0) {
    console.log(`  ${boldStr('Saved by filters:')}     ~${savedTokens.toLocaleString()} tokens`);
  }

  if (report.unknownSkills.length > 0) {
    line();
    warn(`Unknown skills (not in filter list, disabled by default): ${report.unknownSkills.join(', ')}`);
  }

  line();
  dim(`Tip: curato install ${pluginName} --exclude <skill> to disable a skill`);
  dim(`     curato install ${pluginName} --include <skill> to keep only a skill`);
}

import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { claudeBin } from '../../utils/platform.js';
import { ok, fail, info } from '../print.js';

const HELP = `
USAGE
  curato uninstall <plugin>

EXAMPLES
  curato uninstall superpowers
`;

export async function uninstall(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) { console.log(HELP); return; }

  const pluginName = positionals[0];
  if (!pluginName) {
    console.error('Error: plugin name is required.\n');
    console.log(HELP);
    process.exit(1);
  }

  info(`Uninstalling plugin "${pluginName}"...`);

  const result = spawnSync(claudeBin(), ['plugin', 'uninstall', pluginName], {
    encoding: 'utf8',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    fail(`claude plugin uninstall ${pluginName} failed (exit ${result.status ?? 'unknown'})`);
    process.exit(1);
  }

  ok(`Plugin "${pluginName}" uninstalled`);
}

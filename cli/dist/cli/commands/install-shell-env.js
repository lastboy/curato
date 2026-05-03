import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installShellEnv, LAUNCH_AGENT_LABEL } from '../../patcher/shell-env.js';
import { ok, fail, info, dim, warn } from '../print.js';
const HELP = `
USAGE
  curato install-shell-env [options]

OPTIONS
  --var <NAME>           Env var name to forward (repeatable)
  --source-file <path>   Shell startup file to source. Default: ~/.zshrc
  --config [path]        Read var list from curato-setup.json (default: ./curato-setup.json)
  --dry-run              Print the generated plist without writing
  --help                 Show this help

EXAMPLES
  curato install-shell-env --var ADO_MCP_AUTH_TOKEN
  curato install-shell-env --var ADO_MCP_AUTH_TOKEN --var GITHUB_TOKEN
  curato install-shell-env --config           # reads shellEnv.vars from curato-setup.json
  curato install-shell-env --dry-run --var X  # preview

DETAILS
  Installs a LaunchAgent (${LAUNCH_AGENT_LABEL}) that runs at login and forwards
  the listed env vars from your shell startup file into launchd's environment.
  GUI-launched apps (VS Code from Dock, etc.) then inherit these vars — fixing
  the common "MCP auth works in terminal but fails in GUI" issue.

  The plist NEVER contains the var values — only the var names. Values are
  read from your shell startup file at login time.

  macOS only. Linux/Windows use different mechanisms (systemd user / SETX)
  and are not supported here yet.
`;
export async function installShellEnvCmd(argv) {
    if (process.platform !== 'darwin') {
        fail(`install-shell-env is macOS only. Detected platform: ${process.platform}`);
        process.exit(1);
    }
    const { values } = parseArgs({
        args: argv,
        options: {
            var: { type: 'string', multiple: true },
            'source-file': { type: 'string' },
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
    let vars = values.var ?? [];
    // If --config is passed (even with no value), read vars from curato-setup.json.
    if ('config' in values) {
        const configPath = values.config ?? join(process.cwd(), 'curato-setup.json');
        try {
            const raw = JSON.parse(readFileSync(configPath, 'utf8'));
            const fromConfig = raw.shellEnv?.vars ?? [];
            vars = [...vars, ...fromConfig];
        }
        catch (err) {
            fail(`Could not read shellEnv.vars from ${configPath}: ${err instanceof Error ? err.message : String(err)}`);
            process.exit(1);
        }
    }
    if (vars.length === 0) {
        fail('No vars specified. Pass --var NAME (repeatable) or --config to read from curato-setup.json.');
        process.exit(1);
    }
    const sourceFile = values['source-file'];
    try {
        const result = installShellEnv({ vars, sourceFile, dryRun });
        if (dryRun) {
            info(`dry-run: would install ${result.plistPath}`);
            info(`vars: ${result.vars.join(', ')}`);
            dim('--- plist content ---');
            console.log(result.plistContent);
            return;
        }
        ok(`Installed LaunchAgent: ${result.plistPath}`);
        info(`Forwarding vars: ${result.vars.join(', ')}`);
        if (result.loaded)
            ok('LaunchAgent loaded into launchd');
        else
            warn('Plist written, but launchctl load failed — try: launchctl load ' + result.plistPath);
        dim('Quit and relaunch VS Code (or any GUI app) for it to pick up the vars.');
    }
    catch (err) {
        fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}
//# sourceMappingURL=install-shell-env.js.map
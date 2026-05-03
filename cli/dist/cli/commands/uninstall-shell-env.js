import { parseArgs } from 'node:util';
import { uninstallShellEnv, readInstalledVars, launchAgentPath } from '../../patcher/shell-env.js';
import { ok, fail, info, dim, warn } from '../print.js';
const HELP = `
USAGE
  curato uninstall-shell-env [options]

OPTIONS
  --keep-vars   Don't call launchctl unsetenv — leave current session's vars alone
  --dry-run     Preview without removing
  --help        Show this help

DESCRIPTION
  Unloads and removes the Curato shell-env LaunchAgent. By default, also calls
  'launchctl unsetenv' for each var the plist was forwarding, so the current
  session stops seeing them.

  The source values in your shell startup file (e.g. ~/.zshrc) are NOT
  touched — uninstall only removes what install created.
`;
export async function uninstallShellEnvCmd(argv) {
    if (process.platform !== 'darwin') {
        fail(`uninstall-shell-env is macOS only. Detected platform: ${process.platform}`);
        process.exit(1);
    }
    const { values } = parseArgs({
        args: argv,
        options: {
            'keep-vars': { type: 'boolean', default: false },
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
    const keepVars = values['keep-vars'];
    const plistPath = launchAgentPath();
    const installedVars = readInstalledVars();
    if (dryRun) {
        info(`dry-run: would remove ${plistPath}`);
        if (installedVars.length > 0 && !keepVars) {
            info(`dry-run: would launchctl unsetenv: ${installedVars.join(', ')}`);
        }
        return;
    }
    try {
        const result = uninstallShellEnv({
            dryRun: false,
            varsToUnset: keepVars ? undefined : installedVars,
        });
        if (!result.existed) {
            dim(`Nothing to do — no LaunchAgent at ${plistPath}`);
            return;
        }
        ok(`Removed LaunchAgent: ${plistPath}`);
        if (result.unloaded)
            ok('Unloaded from launchd');
        else
            warn('Unload may have failed — reboot or relogin to be sure');
        if (result.unsetVars.length > 0) {
            dim(`launchctl unsetenv: ${result.unsetVars.join(', ')}`);
        }
    }
    catch (err) {
        fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
    }
}
//# sourceMappingURL=uninstall-shell-env.js.map
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
export const LAUNCH_AGENT_LABEL = 'com.curato.shell-env';
export function launchAgentPath() {
    return join(homedir(), 'Library', 'LaunchAgents', `${LAUNCH_AGENT_LABEL}.plist`);
}
/**
 * Build a LaunchAgent plist that sources the user's shell startup file and
 * forwards the named env vars into launchd's environment — so GUI-launched
 * apps (VS Code from Dock, Claude Code from Spotlight) inherit them.
 *
 * The PAT / token values are NEVER embedded in the plist; only the var
 * names are. The plist runs a shell that reads the values from the startup
 * file at login time.
 */
export function buildPlist(vars, sourceFile) {
    const varsList = vars.join(' ');
    const cmd = `[ -f "${sourceFile}" ] && source "${sourceFile}"; ` +
        `for var in ${varsList}; do ` +
        `val=\${(P)var}; ` +
        `[ -n "$val" ] && /bin/launchctl setenv "$var" "$val"; ` +
        `done`;
    const escaped = cmd.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-c</string>
    <string>${escaped}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/${LAUNCH_AGENT_LABEL}.out</string>
  <key>StandardErrorPath</key>
  <string>/tmp/${LAUNCH_AGENT_LABEL}.err</string>
</dict>
</plist>
`;
}
export function installShellEnv(opts) {
    if (opts.vars.length === 0) {
        throw new Error('installShellEnv: at least one var name is required');
    }
    for (const v of opts.vars) {
        if (!/^[A-Z_][A-Z0-9_]*$/i.test(v)) {
            throw new Error(`Invalid env var name: "${v}" (must match /^[A-Z_][A-Z0-9_]*$/i)`);
        }
    }
    const sourceFile = opts.sourceFile ?? join(homedir(), '.zshrc');
    const plistPath = opts.targetPath ?? launchAgentPath();
    const plistContent = buildPlist(opts.vars, sourceFile);
    if (opts.dryRun) {
        return { plistPath, plistContent, wrote: false, loaded: false, vars: opts.vars };
    }
    mkdirSync(dirname(plistPath), { recursive: true });
    writeFileSync(plistPath, plistContent, 'utf8');
    if (opts.skipLoad) {
        return { plistPath, plistContent, wrote: true, loaded: false, vars: opts.vars };
    }
    // Unload first (in case an older version is loaded), then load fresh.
    spawnSync('/bin/launchctl', ['unload', plistPath], { stdio: 'ignore' });
    const loadRes = spawnSync('/bin/launchctl', ['load', plistPath], { encoding: 'utf8' });
    return {
        plistPath,
        plistContent,
        wrote: true,
        loaded: loadRes.status === 0,
        vars: opts.vars,
    };
}
export function uninstallShellEnv(opts) {
    const plistPath = opts.targetPath ?? launchAgentPath();
    const existed = existsSync(plistPath);
    if (opts.dryRun) {
        return { plistPath, existed, removed: false, unloaded: false, unsetVars: [] };
    }
    let unloaded = false;
    if (existed && !opts.skipUnload) {
        const r = spawnSync('/bin/launchctl', ['unload', plistPath], { stdio: 'ignore' });
        unloaded = r.status === 0;
    }
    if (existed)
        unlinkSync(plistPath);
    const unset = [];
    if (!opts.skipUnload && opts.varsToUnset && opts.varsToUnset.length > 0) {
        for (const v of opts.varsToUnset) {
            spawnSync('/bin/launchctl', ['unsetenv', v], { stdio: 'ignore' });
            unset.push(v);
        }
    }
    return { plistPath, existed, removed: existed, unloaded, unsetVars: unset };
}
/**
 * Extract the var names a currently-installed plist forwards. Used by
 * `uninstall-shell-env` to know which vars to `launchctl unsetenv`.
 */
export function readInstalledVars(targetPath) {
    const plistPath = targetPath ?? launchAgentPath();
    if (!existsSync(plistPath))
        return [];
    const content = readFileSync(plistPath, 'utf8');
    const match = content.match(/for var in ([A-Z0-9_ ]+);/i);
    if (!match)
        return [];
    return match[1].trim().split(/\s+/).filter(Boolean);
}
//# sourceMappingURL=shell-env.js.map
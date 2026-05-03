export declare const LAUNCH_AGENT_LABEL = "com.curato.shell-env";
export declare function launchAgentPath(): string;
/**
 * Build a LaunchAgent plist that sources the user's shell startup file and
 * forwards the named env vars into launchd's environment — so GUI-launched
 * apps (VS Code from Dock, Claude Code from Spotlight) inherit them.
 *
 * The PAT / token values are NEVER embedded in the plist; only the var
 * names are. The plist runs a shell that reads the values from the startup
 * file at login time.
 */
export declare function buildPlist(vars: string[], sourceFile: string): string;
export interface InstallShellEnvOptions {
    vars: string[];
    sourceFile?: string;
    dryRun: boolean;
    /** Override plist destination — primarily for tests. */
    targetPath?: string;
    /** Skip actually invoking launchctl — primarily for tests. */
    skipLoad?: boolean;
}
export interface InstallShellEnvResult {
    plistPath: string;
    plistContent: string;
    wrote: boolean;
    loaded: boolean;
    vars: string[];
}
export declare function installShellEnv(opts: InstallShellEnvOptions): InstallShellEnvResult;
export interface UninstallShellEnvOptions {
    dryRun: boolean;
    /** Override plist destination — primarily for tests. */
    targetPath?: string;
    /** Skip actually invoking launchctl — primarily for tests. */
    skipUnload?: boolean;
    /** Also call `launchctl unsetenv` for these vars. */
    varsToUnset?: string[];
}
export interface UninstallShellEnvResult {
    plistPath: string;
    existed: boolean;
    removed: boolean;
    unloaded: boolean;
    unsetVars: string[];
}
export declare function uninstallShellEnv(opts: UninstallShellEnvOptions): UninstallShellEnvResult;
/**
 * Extract the var names a currently-installed plist forwards. Used by
 * `uninstall-shell-env` to know which vars to `launchctl unsetenv`.
 */
export declare function readInstalledVars(targetPath?: string): string[];
//# sourceMappingURL=shell-env.d.ts.map
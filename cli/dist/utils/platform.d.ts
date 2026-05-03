export declare let _platform: NodeJS.Platform;
export declare function setPlatformOverride(p: NodeJS.Platform): void;
export declare function resetPlatformOverride(): void;
export declare function isWin(): boolean;
/** Claude CLI binary name. Windows requires the `.cmd` wrapper. */
export declare function claudeBin(): string;
/** Command to locate executables on PATH. */
export declare function whichCmd(): string;
/** PATH separator character. */
export declare function pathSep(): string;
/** Cross-platform temp directory. */
export declare function tmpDir(): string;
/**
 * Directory where Claude Code stores its config (settings.json, plugins/, etc.)
 *
 * macOS/Linux: ~/.claude
 * Windows: %APPDATA%\Claude if it exists, otherwise ~/.claude
 *
 * TODO: verify the Windows path on a real Windows machine — Claude Code may use
 * %APPDATA%\Claude or %USERPROFILE%\.claude depending on the installer version.
 */
export declare function getClaudeDir(): string;
/**
 * Path to the CLI registry file written by `claude mcp add`.
 *
 * macOS/Linux: ~/.claude.json
 * Windows: assumed to be the same path (Claude CLI follows %USERPROFILE%).
 * TODO: verify on a real Windows machine.
 */
export declare function getClaudeJsonPath(): string;
/**
 * Ordered list of Chrome binary paths to try on the current platform.
 * The caller should try each in order and use the first one that exists.
 */
export declare function chromeCandidates(): string[];
//# sourceMappingURL=platform.d.ts.map
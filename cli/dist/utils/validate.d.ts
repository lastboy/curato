/**
 * Validate a plugin or skill name. Names are used to construct file paths
 * under ~/.claude/plugins/cache/, so any input that could escape its directory
 * (slashes, backslashes, .. segments) must be rejected.
 *
 * Throws with a descriptive error rather than returning a boolean — callers
 * always want to abort on invalid input, never recover.
 */
export declare function assertSafeName(value: string, kind: 'plugin' | 'skill' | 'marketplace'): void;
/**
 * Validate that a path resolves under the user's home directory. Used to
 * prevent a malicious curato-setup.json (esp. one fetched via `extends:`)
 * from pointing `shellEnv.sourceFile` at a system path or attacker-controlled
 * location, since the LaunchAgent sources that file at every login.
 *
 * Accepts `~/...` and absolute paths; rejects anything that resolves outside
 * $HOME after normalization.
 */
export declare function assertPathUnderHome(filePath: string, label: string): string;
/**
 * Allowlist of hosts that `extends:` can fetch remote config from.
 * Used by team-config.ts when following HTTP redirects — prevents a
 * compromised or typo-squatted github URL from redirecting to an
 * attacker-controlled host.
 */
export declare const ALLOWED_REMOTE_HOSTS: Set<string>;
export declare function isAllowedRemoteHost(url: string): boolean;
//# sourceMappingURL=validate.d.ts.map
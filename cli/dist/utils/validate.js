import { resolve } from 'node:path';
import { homedir } from 'node:os';
const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/i;
/**
 * Validate a plugin or skill name. Names are used to construct file paths
 * under ~/.claude/plugins/cache/, so any input that could escape its directory
 * (slashes, backslashes, .. segments) must be rejected.
 *
 * Throws with a descriptive error rather than returning a boolean — callers
 * always want to abort on invalid input, never recover.
 */
export function assertSafeName(value, kind) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Invalid ${kind} name: must be a non-empty string`);
    }
    if (value.length > 100) {
        throw new Error(`Invalid ${kind} name "${value}": max 100 characters`);
    }
    if (!NAME_RE.test(value)) {
        throw new Error(`Invalid ${kind} name "${value}": only letters, digits, dot, underscore, hyphen allowed (must start with letter or digit)`);
    }
}
/**
 * Validate that a path resolves under the user's home directory. Used to
 * prevent a malicious curato-setup.json (esp. one fetched via `extends:`)
 * from pointing `shellEnv.sourceFile` at a system path or attacker-controlled
 * location, since the LaunchAgent sources that file at every login.
 *
 * Accepts `~/...` and absolute paths; rejects anything that resolves outside
 * $HOME after normalization.
 */
export function assertPathUnderHome(filePath, label) {
    if (typeof filePath !== 'string' || filePath.length === 0) {
        throw new Error(`Invalid ${label}: must be a non-empty string`);
    }
    const home = homedir();
    const expanded = filePath.startsWith('~/') ? filePath.replace(/^~/, home) : filePath;
    const abs = resolve(expanded);
    const homeAbs = resolve(home);
    if (abs !== homeAbs && !abs.startsWith(homeAbs + '/') && !abs.startsWith(homeAbs + '\\')) {
        throw new Error(`Invalid ${label} "${filePath}": must resolve under ${homeAbs}`);
    }
    return abs;
}
/**
 * Allowlist of hosts that `extends:` can fetch remote config from.
 * Used by team-config.ts when following HTTP redirects — prevents a
 * compromised or typo-squatted github URL from redirecting to an
 * attacker-controlled host.
 */
export const ALLOWED_REMOTE_HOSTS = new Set(['raw.githubusercontent.com']);
export function isAllowedRemoteHost(url) {
    try {
        return ALLOWED_REMOTE_HOSTS.has(new URL(url).hostname);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=validate.js.map
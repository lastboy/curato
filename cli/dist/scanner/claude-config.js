import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { scanPluginState } from './plugin-state.js';
import { getClaudeDir, getClaudeJsonPath } from '../utils/platform.js';
export { getClaudeDir, getClaudeJsonPath };
export function scanUserSetup() {
    const claudeDir = getClaudeDir();
    const settingsJsonPath = join(claudeDir, 'settings.json');
    const claudeMdPath = join(claudeDir, 'CLAUDE.md');
    const pluginsDir = join(claudeDir, 'plugins', 'marketplaces');
    return {
        settingsJsonPath,
        settingsJsonExists: existsSync(settingsJsonPath),
        claudeMdPath,
        claudeMdExists: existsSync(claudeMdPath),
        pluginsDir,
        pluginsDirExists: existsSync(pluginsDir),
        installedPlugins: scanPluginState(),
    };
}
export function readSettingsJson() {
    const path = join(getClaudeDir(), 'settings.json');
    if (!existsSync(path))
        return {};
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    }
    catch {
        return {};
    }
}
/** Read ~/.claude.json — the CLI registry written by `claude mcp add` */
export function readClaudeJson() {
    const path = getClaudeJsonPath();
    if (!existsSync(path))
        return {};
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed;
        }
        return {};
    }
    catch {
        return {};
    }
}
export function findClaudeMdUp(startDir) {
    let dir = startDir;
    const root = homedir();
    for (let i = 0; i < 10; i++) {
        const candidate = join(dir, 'CLAUDE.md');
        if (existsSync(candidate))
            return candidate;
        const parent = join(dir, '..');
        if (parent === dir || dir === root)
            break;
        dir = parent;
    }
    return null;
}
//# sourceMappingURL=claude-config.js.map
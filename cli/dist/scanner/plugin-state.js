import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getClaudeDir } from '../utils/platform.js';
function readPluginJson(pluginDir) {
    const path = join(pluginDir, '.claude-plugin', 'plugin.json');
    if (!existsSync(path))
        return { data: null, path };
    try {
        return { data: JSON.parse(readFileSync(path, 'utf8')), path };
    }
    catch {
        return { data: null, path };
    }
}
function scanPluginDir(pluginDir, entry) {
    const { data, path } = readPluginJson(pluginDir);
    const issues = [];
    if (!data) {
        issues.push('plugin.json missing or unparseable');
        return { name: entry, pluginJsonPath: path, valid: false, issues };
    }
    if (typeof data.name !== 'string' || !data.name) {
        issues.push('plugin.json missing required field: name');
    }
    if (typeof data.description !== 'string' || !data.description) {
        issues.push('plugin.json missing required field: description');
    }
    return {
        name: typeof data.name === 'string' ? data.name : entry,
        pluginJsonPath: path,
        valid: issues.length === 0,
        version: typeof data.version === 'string' ? data.version : undefined,
        issues,
    };
}
function scanMarketplace(marketplaceDir) {
    // Official marketplace layout: <marketplace>/plugins/<plugin-name>/
    const pluginsSubdir = join(marketplaceDir, 'plugins');
    const scanDir = existsSync(pluginsSubdir) ? pluginsSubdir : marketplaceDir;
    let entries;
    try {
        entries = readdirSync(scanDir);
    }
    catch {
        return [];
    }
    return entries
        .filter((e) => !e.startsWith('.') && e !== 'node_modules')
        .map((entry) => scanPluginDir(join(scanDir, entry), entry));
}
function getMarketplaceDirs() {
    const dirs = [];
    // Standard marketplace dirs under ~/.claude/plugins/marketplaces/
    const marketplacesDir = join(getClaudeDir(), 'plugins', 'marketplaces');
    if (existsSync(marketplacesDir)) {
        try {
            for (const m of readdirSync(marketplacesDir)) {
                dirs.push(join(marketplacesDir, m));
            }
        }
        catch { /* ignore */ }
    }
    // Extra marketplaces from known_marketplaces.json (e.g. local directory marketplaces)
    const knownPath = join(getClaudeDir(), 'plugins', 'known_marketplaces.json');
    if (existsSync(knownPath)) {
        try {
            const known = JSON.parse(readFileSync(knownPath, 'utf8'));
            for (const entry of Object.values(known)) {
                if (typeof entry !== 'object' || entry === null)
                    continue;
                const loc = entry['installLocation'];
                if (typeof loc === 'string' && existsSync(loc) && !dirs.includes(loc)) {
                    dirs.push(loc);
                }
            }
        }
        catch { /* ignore */ }
    }
    return dirs;
}
export function scanPluginState(pluginName) {
    const all = [];
    const seen = new Set();
    for (const marketplaceDir of getMarketplaceDirs()) {
        for (const plugin of scanMarketplace(marketplaceDir)) {
            if (!seen.has(plugin.name)) {
                seen.add(plugin.name);
                all.push(plugin);
            }
        }
    }
    if (pluginName) {
        return all.filter((p) => p.name === pluginName);
    }
    return all;
}
//# sourceMappingURL=plugin-state.js.map
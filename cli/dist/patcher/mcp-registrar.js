import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeMerge } from './json-merger.js';
import { backupFile } from './backup.js';
import { getClaudeDir } from '../utils/platform.js';
/**
 * Add or verify an MCP server entry in ~/.claude/settings.json.
 * Uses safeMerge — existing entries are never modified.
 */
export function registerMcpServer(opts) {
    const settingsPath = opts.settingsPath ?? join(getClaudeDir(), 'settings.json');
    let settings = {};
    if (existsSync(settingsPath)) {
        try {
            settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
        }
        catch {
            settings = {};
        }
    }
    const existingMcp = settings['mcpServers'] && typeof settings['mcpServers'] === 'object'
        ? settings['mcpServers']
        : {};
    const alreadyPresent = opts.serverName in existingMcp;
    const newMcp = safeMerge(existingMcp, {
        [opts.serverName]: opts.entry,
    });
    const proposed = JSON.stringify(newMcp, null, 2);
    if (!opts.dryRun && !alreadyPresent) {
        const backupDir = backupFile(settingsPath);
        const updated = safeMerge(settings, { mcpServers: newMcp });
        writeFileSync(settingsPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
        return { dryRun: false, settingsPath, serverName: opts.serverName, alreadyPresent, backupDir, proposed };
    }
    return { dryRun: opts.dryRun, settingsPath, serverName: opts.serverName, alreadyPresent, proposed };
}
//# sourceMappingURL=mcp-registrar.js.map
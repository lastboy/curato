import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { backupFile } from './backup.js';
import { getClaudeDir, getClaudeJsonPath } from '../utils/platform.js';
function readJsonFile(filePath) {
    if (!existsSync(filePath))
        return {};
    try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed;
        }
        return {};
    }
    catch {
        return {};
    }
}
function extractMcp(obj) {
    return obj['mcpServers'] && typeof obj['mcpServers'] === 'object' && !Array.isArray(obj['mcpServers'])
        ? obj['mcpServers']
        : {};
}
export function removeMcpServer(opts) {
    const { serverName, dryRun, cwd = process.cwd(), settingsJsonPath = join(getClaudeDir(), 'settings.json'), settingsLocalJsonPath = join(getClaudeDir(), 'settings.local.json'), claudeJsonPath = getClaudeJsonPath(), mcpJsonPath = join(cwd, '.mcp.json'), } = opts;
    const removedFrom = [];
    const notFound = [];
    // --- ~/.claude/settings.json ---
    const settingsJson = readJsonFile(settingsJsonPath);
    const settingsMcp = extractMcp(settingsJson);
    const inSettings = Object.prototype.hasOwnProperty.call(settingsMcp, serverName);
    if (inSettings)
        removedFrom.push('~/.claude/settings.json');
    else
        notFound.push('~/.claude/settings.json');
    // --- ~/.claude/settings.local.json ---
    const settingsLocalJson = readJsonFile(settingsLocalJsonPath);
    const settingsLocalMcp = extractMcp(settingsLocalJson);
    const inSettingsLocal = Object.prototype.hasOwnProperty.call(settingsLocalMcp, serverName);
    if (inSettingsLocal)
        removedFrom.push('~/.claude/settings.local.json');
    else
        notFound.push('~/.claude/settings.local.json');
    // --- ~/.claude.json (top-level mcpServers) ---
    const claudeJson = readJsonFile(claudeJsonPath);
    const claudeMcp = extractMcp(claudeJson);
    const inClaudeJson = Object.prototype.hasOwnProperty.call(claudeMcp, serverName);
    if (inClaudeJson)
        removedFrom.push('~/.claude.json');
    else
        notFound.push('~/.claude.json');
    // --- ~/.claude.json project-scoped entries ---
    const projects = claudeJson['projects'];
    const projectKeysWithServer = [];
    if (projects && typeof projects === 'object' && !Array.isArray(projects)) {
        for (const [projectKey, projectVal] of Object.entries(projects)) {
            if (projectVal && typeof projectVal === 'object' && !Array.isArray(projectVal)) {
                const projectMcp = projectVal['mcpServers'];
                if (projectMcp &&
                    typeof projectMcp === 'object' &&
                    !Array.isArray(projectMcp) &&
                    Object.prototype.hasOwnProperty.call(projectMcp, serverName)) {
                    projectKeysWithServer.push(projectKey);
                    removedFrom.push(`~/.claude.json#projects.${projectKey}`);
                }
            }
        }
    }
    // --- .mcp.json in cwd ---
    const mcpJson = readJsonFile(mcpJsonPath);
    const mcpJsonMcp = extractMcp(mcpJson);
    const inMcpJson = Object.prototype.hasOwnProperty.call(mcpJsonMcp, serverName);
    if (inMcpJson)
        removedFrom.push('.mcp.json');
    else
        notFound.push('.mcp.json');
    if (dryRun) {
        return { serverName, dryRun, removedFrom, notFound };
    }
    // --- Apply writes ---
    let backupDir;
    if (inSettings) {
        backupDir = backupFile(settingsJsonPath);
        delete settingsMcp[serverName];
        settingsJson['mcpServers'] = settingsMcp;
        writeFileSync(settingsJsonPath, JSON.stringify(settingsJson, null, 2) + '\n', 'utf8');
    }
    if (inSettingsLocal) {
        const localBackupDir = backupFile(settingsLocalJsonPath);
        if (!backupDir)
            backupDir = localBackupDir;
        delete settingsLocalMcp[serverName];
        settingsLocalJson['mcpServers'] = settingsLocalMcp;
        writeFileSync(settingsLocalJsonPath, JSON.stringify(settingsLocalJson, null, 2) + '\n', 'utf8');
    }
    if (inClaudeJson || projectKeysWithServer.length > 0) {
        const claudeBackupDir = backupFile(claudeJsonPath);
        if (!backupDir)
            backupDir = claudeBackupDir;
        if (inClaudeJson) {
            delete claudeMcp[serverName];
            claudeJson['mcpServers'] = claudeMcp;
        }
        if (projectKeysWithServer.length > 0) {
            const projectsObj = claudeJson['projects'];
            for (const projectKey of projectKeysWithServer) {
                const projectMcp = projectsObj[projectKey]?.['mcpServers'];
                if (projectMcp) {
                    delete projectMcp[serverName];
                    projectsObj[projectKey]['mcpServers'] = projectMcp;
                }
            }
            claudeJson['projects'] = projectsObj;
        }
        writeFileSync(claudeJsonPath, JSON.stringify(claudeJson, null, 2) + '\n', 'utf8');
    }
    if (inMcpJson) {
        const mcpJsonBackupDir = backupFile(mcpJsonPath);
        if (!backupDir)
            backupDir = mcpJsonBackupDir;
        delete mcpJsonMcp[serverName];
        mcpJson['mcpServers'] = mcpJsonMcp;
        writeFileSync(mcpJsonPath, JSON.stringify(mcpJson, null, 2) + '\n', 'utf8');
    }
    return { serverName, dryRun, removedFrom, notFound, backupDir };
}
//# sourceMappingURL=mcp-remover.js.map
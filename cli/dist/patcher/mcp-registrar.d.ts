export interface McpRegistrationEntry {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}
export interface RegisterMcpResult {
    dryRun: boolean;
    settingsPath: string;
    serverName: string;
    alreadyPresent: boolean;
    backupDir?: string;
    proposed: string;
}
/**
 * Add or verify an MCP server entry in ~/.claude/settings.json.
 * Uses safeMerge — existing entries are never modified.
 */
export declare function registerMcpServer(opts: {
    serverName: string;
    entry: McpRegistrationEntry;
    dryRun: boolean;
    settingsPath?: string;
}): RegisterMcpResult;
//# sourceMappingURL=mcp-registrar.d.ts.map
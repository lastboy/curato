export interface RemoveMcpResult {
    serverName: string;
    dryRun: boolean;
    removedFrom: string[];
    notFound: string[];
    backupDir?: string;
}
export interface RemoveMcpOptions {
    serverName: string;
    dryRun: boolean;
    cwd?: string;
    settingsJsonPath?: string;
    settingsLocalJsonPath?: string;
    claudeJsonPath?: string;
    mcpJsonPath?: string;
}
export declare function removeMcpServer(opts: RemoveMcpOptions): RemoveMcpResult;
//# sourceMappingURL=mcp-remover.d.ts.map
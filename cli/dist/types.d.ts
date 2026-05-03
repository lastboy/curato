export type Severity = 'ok' | 'warn' | 'error' | 'missing';
export interface CheckResult {
    id: string;
    label: string;
    severity: Severity;
    detail: string;
    fix?: string;
    fixable: boolean;
}
export interface ScanReport {
    timestamp: string;
    scope: 'user' | 'project' | 'full';
    persona: string;
    checks: CheckResult[];
    summary: {
        ok: number;
        warn: number;
        error: number;
        missing: number;
    };
}
export interface RepairProposal {
    check: CheckResult;
    action: 'create-if-missing' | 'merge' | 'append' | 'overwrite' | 'register-mcp' | 'run-command';
    targetPath: string;
    command?: string[];
    before?: string;
    after: string;
}
export interface RepairReport {
    dryRun: boolean;
    proposals: RepairProposal[];
    applied: RepairProposal[];
    backupDir?: string;
}
export interface SmokeTestResult {
    step: string;
    passed: boolean;
    output?: string;
    error?: string;
}
export interface SmokeTestReport {
    passed: boolean;
    steps: SmokeTestResult[];
    fixturePath: string;
}
export interface NodeRuntimeInfo {
    nodeVersion: string;
    nodeMinMet: boolean;
    nodePath: string;
    npmVersion: string;
    nvmActive: boolean;
    nvmCurrentVersion?: string;
    pathContainsNvm: boolean;
}
export interface McpServerEntry {
    name: string;
    command?: string;
    args?: string[];
    type?: 'stdio' | 'http';
    url?: string;
    env?: Record<string, string>;
    registeredIn: 'project' | 'global';
    /** Which config file this entry came from */
    source?: 'vscode' | 'cli' | 'project';
    binaryResolvable: boolean;
    binaryPath?: string;
}
export interface PluginInfo {
    name: string;
    pluginJsonPath: string;
    valid: boolean;
    version?: string;
    issues: string[];
}
export interface ProjectLayoutInfo {
    cwd: string;
    hasClaudeDir: boolean;
    hasClaudeMd: boolean;
    hasMcpJson: boolean;
    hasSettingsLocal: boolean;
    hasHooksJson: boolean;
    agentFiles: string[];
    commandFiles: string[];
    skillFiles: string[];
}
export interface UserSetupInfo {
    settingsJsonPath: string;
    settingsJsonExists: boolean;
    claudeMdPath: string;
    claudeMdExists: boolean;
    pluginsDir: string;
    pluginsDirExists: boolean;
    installedPlugins: PluginInfo[];
}
export interface ScanEnvironmentParams {
    cwd?: string;
    scope?: 'user' | 'project' | 'full';
}
export interface InspectUserSetupParams {
}
export interface InspectProjectSetupParams {
    cwd?: string;
}
export interface RecommendSetupParams {
    cwd?: string;
    goals?: string[];
}
export interface ApplySetupParams {
    cwd?: string;
    dryRun: boolean;
    targets?: string[];
}
export interface RepairSetupParams {
    checkIds: string[];
    cwd?: string;
    dryRun: boolean;
}
export interface CheckNodeRuntimeParams {
}
export interface CheckPluginStateParams {
    pluginName?: string;
}
export interface CheckMcpRegistrationParams {
    serverName?: string;
    cwd?: string;
}
export interface CreateSmokeTestAppParams {
    targetDir: string;
}
export interface RunSmokeTestParams {
    fixtureDir?: string;
}
export interface ApplyTeamSetupParams {
    configPath?: string;
    cwd?: string;
    dryRun: boolean;
}
export interface RemoveMcpServerParams {
    serverName: string;
    dryRun: boolean;
}
export interface RegisterMcpBothParams {
    serverName: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    dryRun: boolean;
}
export interface RemovePluginParams {
    pluginName: string;
    dryRun: boolean;
}
export interface ClearPluginCacheParams {
    pluginName?: string;
    marketplaceName?: string;
    dryRun: boolean;
}
export interface UninstallCuratoParams {
    dryRun: boolean;
}
export interface ClearCacheResult {
    dryRun: boolean;
    cleared: string[];
    skipped: string[];
    errors: string[];
}
export interface UninstallReport {
    dryRun: boolean;
    pluginsRemoved: string[];
    mcpServersRemoved: string[];
    cacheDirsCleared: string[];
    backupDirs?: string[];
    errors: string[];
}
export interface TeamMcpEntry {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    scope: 'user' | 'project';
    enabled?: boolean;
}
export interface TeamClaudeMdEntry {
    mode: 'create-if-missing' | 'append-if-missing-section';
    content: string;
    section?: string;
}
export interface TeamPluginEntry {
    name: string;
    enabled?: boolean;
    skills?: {
        include: string[];
        exclude: string[];
    };
}
export interface TeamShellEnvConfig {
    /** Names of env vars to forward from shell startup file into launchd, e.g. ["ADO_MCP_AUTH_TOKEN"]. */
    vars: string[];
    /** Shell file to source for reading the vars. Defaults to ~/.zshrc. */
    sourceFile?: string;
    /** Set false to skip without removing the entry. Default: true. */
    enabled?: boolean;
}
export interface TeamMarketplaceEntry {
    source: string;
    scope?: 'user' | 'project' | 'local';
    enabled?: boolean;
    sparse?: string[];
}
export interface TeamSetupConfig {
    version: 1;
    extends?: string;
    shellEnv?: TeamShellEnvConfig;
    marketplaces?: Record<string, TeamMarketplaceEntry>;
    mcpServers?: Record<string, TeamMcpEntry>;
    plugins?: (string | TeamPluginEntry)[];
    claudeMd?: {
        project?: TeamClaudeMdEntry;
        user?: TeamClaudeMdEntry;
    };
}
export declare const StatusMessages: {
    readonly scanStart: "Scanning environment...";
    readonly scanDone: "Scan complete.";
    readonly repairStart: "Preparing repairs...";
    readonly repairDone: "Repairs applied.";
    readonly smokeStart: "Running smoke test...";
    readonly smokeDone: "Smoke test complete.";
    readonly dryRun: "Dry-run mode — no changes will be applied.";
    readonly backupNote: (dir: string) => string;
    readonly operational: "Curato is operational.";
    readonly anomaly: (n: number) => string;
};
export declare function toolResult(data: unknown): {
    content: Array<{
        type: 'text';
        text: string;
    }>;
};
//# sourceMappingURL=types.d.ts.map
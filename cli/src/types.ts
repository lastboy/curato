// ============================================================
// Core result types
// ============================================================

export type Severity = 'ok' | 'warn' | 'error' | 'missing';

export interface CheckResult {
  id: string;        // e.g. "node.version", "mcp.chrome-devtools"
  label: string;     // Human-readable label
  severity: Severity;
  detail: string;    // One-line description of the finding
  fix?: string;      // Optional description of how to fix (shown in repair)
  fixable: boolean;  // Whether repair_setup can auto-fix this
}

export interface ScanReport {
  timestamp: string;
  scope: 'user' | 'project' | 'full';
  persona: string;   // Always "curato"
  checks: CheckResult[];
  summary: { ok: number; warn: number; error: number; missing: number };
}

export interface RepairProposal {
  check: CheckResult;
  action: 'create-if-missing' | 'merge' | 'append' | 'overwrite' | 'register-mcp' | 'run-command';
  targetPath: string;
  command?: string[];  // populated when action === 'run-command'
  before?: string;     // Snapshot before change (omitted for new files)
  after: string;       // What the file/entry will look like after
}

export interface RepairReport {
  dryRun: boolean;
  proposals: RepairProposal[];
  applied: RepairProposal[];  // empty when dryRun=true
  backupDir?: string;         // set when !dryRun and files were changed
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

// ============================================================
// Scanner output shapes
// ============================================================

export interface NodeRuntimeInfo {
  nodeVersion: string;        // e.g. "v24.13.1"
  nodeMinMet: boolean;        // >= 18
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

// ============================================================
// Tool parameter types (one per MCP tool)
// ============================================================

export interface ScanEnvironmentParams {
  cwd?: string;
  scope?: 'user' | 'project' | 'full';
}

export interface InspectUserSetupParams {
  // no required params
}

export interface InspectProjectSetupParams {
  cwd?: string;
}

export interface RecommendSetupParams {
  cwd?: string;
  goals?: string[];  // e.g. ["register-mcp", "create-claude-md"]
}

export interface ApplySetupParams {
  cwd?: string;
  dryRun: boolean;
  targets?: string[];  // specific check IDs to fix; omit = fix all fixable
}

export interface RepairSetupParams {
  checkIds: string[];  // from ScanReport.checks[].id
  cwd?: string;
  dryRun: boolean;
}

export interface CheckNodeRuntimeParams {
  // no required params
}

export interface CheckPluginStateParams {
  pluginName?: string;  // check one plugin; omit = check all
}

export interface CheckMcpRegistrationParams {
  serverName?: string;  // check one server; omit = check all
  cwd?: string;
}

export interface CreateSmokeTestAppParams {
  targetDir: string;
}

export interface RunSmokeTestParams {
  fixtureDir?: string;  // default: smoke-test-fixture/ relative to curato dir
}

export interface ApplyTeamSetupParams {
  configPath?: string;  // defaults to ./curato-setup.json
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

// ============================================================
// Team setup config (curato-setup.json)
// ============================================================

export interface TeamMcpEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  scope: 'user' | 'project';
  enabled?: boolean;  // default true; set false to skip without removing
}

export interface TeamClaudeMdEntry {
  mode: 'create-if-missing' | 'append-if-missing-section';
  content: string;
  section?: string;  // required when mode is append-if-missing-section
}

export interface TeamPluginEntry {
  name: string;
  enabled?: boolean;  // default true; set false to skip without removing
  skills?: {
    include: string[];  // active skills — only these are available in context
    exclude: string[];  // disabled skills — kept for reference, excluded by default
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
  source: string;                            // URL, local path, or "github:org/repo"
  scope?: 'user' | 'project' | 'local';     // default: user
  enabled?: boolean;                         // default: true
  sparse?: string[];                         // sparse-checkout paths (for monorepos)
}

export interface TeamSetupConfig {
  version: 1;
  extends?: string;                                    // e.g. "github:mycompany/claude-setup"
  shellEnv?: TeamShellEnvConfig;
  marketplaces?: Record<string, TeamMarketplaceEntry>;
  mcpServers?: Record<string, TeamMcpEntry>;
  plugins?: (string | TeamPluginEntry)[];             // plugin names or entries with skill config
  claudeMd?: {
    project?: TeamClaudeMdEntry;
    user?: TeamClaudeMdEntry;
  };
}

// ============================================================
// Status messages
// ============================================================

export const StatusMessages = {
  scanStart:   'Scanning environment...',
  scanDone:    'Scan complete.',
  repairStart: 'Preparing repairs...',
  repairDone:  'Repairs applied.',
  smokeStart:  'Running smoke test...',
  smokeDone:   'Smoke test complete.',
  dryRun:      'Dry-run mode — no changes will be applied.',
  backupNote:  (dir: string) => `Backup created at ${dir} before making changes.`,
  operational: 'Curato is operational.',
  anomaly:     (n: number) => `Detected ${n} anomal${n === 1 ? 'y' : 'ies'}.`,
} as const;

// ============================================================
// MCP tool response helper
// ============================================================

export function toolResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

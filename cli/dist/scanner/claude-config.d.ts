import type { UserSetupInfo } from '../types.js';
import { getClaudeDir, getClaudeJsonPath } from '../utils/platform.js';
export { getClaudeDir, getClaudeJsonPath };
export declare function scanUserSetup(): UserSetupInfo;
export declare function readSettingsJson(): Record<string, unknown>;
/** Read ~/.claude.json — the CLI registry written by `claude mcp add` */
export declare function readClaudeJson(): Record<string, unknown>;
export declare function findClaudeMdUp(startDir: string): string | null;
//# sourceMappingURL=claude-config.d.ts.map
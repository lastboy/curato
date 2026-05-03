import type { TeamSetupConfig } from '../types.js';
export declare function readTeamConfig(cwd: string): Promise<TeamSetupConfig | null>;
export declare function validateTeamConfig(raw: unknown): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=team-config.d.ts.map
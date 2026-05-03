export type SkillStatus = 'included' | 'excluded' | 'unknown';
export interface SkillCostEntry {
    name: string;
    sizeBytes: number;
    estimatedTokens: number;
    status: SkillStatus;
    /** true if the skill file is currently disabled (.disabled extension) */
    currentlyDisabled: boolean;
}
export interface SkillFilterReport {
    dryRun: boolean;
    pluginName: string;
    cachePath: string | null;
    skills: SkillCostEntry[];
    /** Skills found on disk but not in include or exclude — excluded by default */
    unknownSkills: string[];
    /** Tokens removed from the system-reminder skills list (~80 chars per entry) */
    startupSavingTokens: number;
    /** Tokens saved if all excluded skills would otherwise have been triggered */
    maxSessionSavingTokens: number;
    applied: boolean;
    backupDir?: string;
}
/**
 * Compare two version-like directory names numerically segment-by-segment
 * so that '1.10.0' sorts after '1.2.0'. Non-numeric segments fall back to
 * lexical comparison. Safe for mixed or malformed inputs.
 */
export declare function compareVersions(a: string, b: string): number;
/**
 * Find the highest-version cache directory for a plugin.
 * Searches across all marketplaces under ~/.claude/plugins/cache/
 * Pass `_cacheRoot` to override the default (useful in tests).
 */
export declare function findPluginCachePath(pluginName: string, _cacheRoot?: string): string | null;
/**
 * Scan skill files in the plugin cache and compute a cost report.
 * If `skills` is omitted, all skills are reported as 'included' (no filter applied).
 * Pass `_cacheRoot` to override ~/.claude/plugins/cache (useful in tests).
 */
export declare function reportSkillCosts(pluginName: string, skills?: {
    include: string[];
    exclude: string[];
}, _cacheRoot?: string): SkillFilterReport;
/**
 * Apply the skill filter to the plugin cache:
 * - Excluded/unknown skills: rename skill.md → skill.md.disabled
 * - Included skills: rename skill.md.disabled → skill.md (restore if previously disabled)
 *
 * Backs up any file before renaming. Idempotent — safe to run after every reinstall.
 * Pass `_cacheRoot` to override ~/.claude/plugins/cache (useful in tests).
 */
export declare function applySkillFilter(pluginName: string, skills: {
    include: string[];
    exclude: string[];
}, dryRun: boolean, _cacheRoot?: string): SkillFilterReport;
//# sourceMappingURL=skill-filter.d.ts.map
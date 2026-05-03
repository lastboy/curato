import { existsSync, readdirSync, statSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { backupFile } from './backup.js';
import { getClaudeDir } from '../utils/platform.js';
// ── Helpers ────────────────────────────────────────────────────────────────────
/** Rough estimate: 1 token ≈ 4 characters */
function estimateTokens(bytes) {
    return Math.ceil(bytes / 4);
}
/**
 * Compare two version-like directory names numerically segment-by-segment
 * so that '1.10.0' sorts after '1.2.0'. Non-numeric segments fall back to
 * lexical comparison. Safe for mixed or malformed inputs.
 */
export function compareVersions(a, b) {
    const ap = a.split('.');
    const bp = b.split('.');
    const len = Math.max(ap.length, bp.length);
    for (let i = 0; i < len; i++) {
        const av = ap[i] ?? '0';
        const bv = bp[i] ?? '0';
        const an = Number(av);
        const bn = Number(bv);
        if (Number.isFinite(an) && Number.isFinite(bn)) {
            if (an !== bn)
                return an - bn;
        }
        else if (av !== bv) {
            return av < bv ? -1 : 1;
        }
    }
    return 0;
}
/**
 * Find the highest-version cache directory for a plugin.
 * Searches across all marketplaces under ~/.claude/plugins/cache/
 * Pass `_cacheRoot` to override the default (useful in tests).
 */
export function findPluginCachePath(pluginName, _cacheRoot) {
    const cacheRoot = _cacheRoot ?? join(getClaudeDir(), 'plugins', 'cache');
    if (!existsSync(cacheRoot))
        return null;
    let best = null;
    for (const entry of readdirSync(cacheRoot, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const pluginDir = join(cacheRoot, entry.name, pluginName);
        if (!existsSync(pluginDir))
            continue;
        const versions = readdirSync(pluginDir, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)
            .sort(compareVersions);
        if (versions.length > 0) {
            const candidate = join(pluginDir, versions[versions.length - 1]);
            // Prefer the last found (latest marketplace takes precedence if multiple)
            best = candidate;
        }
    }
    return best;
}
/**
 * Scan skill files in the plugin cache and compute a cost report.
 * If `skills` is omitted, all skills are reported as 'included' (no filter applied).
 * Pass `_cacheRoot` to override ~/.claude/plugins/cache (useful in tests).
 */
export function reportSkillCosts(pluginName, skills, _cacheRoot) {
    const cachePath = findPluginCachePath(pluginName, _cacheRoot);
    const report = {
        dryRun: true,
        pluginName,
        cachePath,
        skills: [],
        unknownSkills: [],
        startupSavingTokens: 0,
        maxSessionSavingTokens: 0,
        applied: false,
    };
    if (!cachePath)
        return report;
    const skillsDir = join(cachePath, 'skills');
    if (!existsSync(skillsDir))
        return report;
    const includeSet = skills ? new Set(skills.include) : null;
    const excludeSet = skills ? new Set(skills.exclude) : new Set();
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory())
            continue;
        const skillName = entry.name;
        if (skillName === 'using-superpowers')
            continue; // never touch the meta-skill
        const skillDir = join(skillsDir, skillName);
        const activePath = findSkillFile(skillDir, false);
        const disabledPath = findSkillFile(skillDir, true);
        const currentlyDisabled = !activePath && !!disabledPath;
        const measurePath = activePath ?? disabledPath;
        if (!measurePath)
            continue;
        const sizeBytes = statSync(measurePath).size;
        const estimatedTokens = estimateTokens(sizeBytes);
        let status;
        if (includeSet === null) {
            status = 'included';
        }
        else if (includeSet.has(skillName)) {
            status = 'included';
        }
        else if (excludeSet.has(skillName)) {
            status = 'excluded';
        }
        else {
            status = 'unknown';
            report.unknownSkills.push(skillName);
        }
        if (status === 'excluded' || status === 'unknown') {
            // ~80 chars per system-reminder entry (name + short description)
            report.startupSavingTokens += Math.ceil(80 / 4);
            report.maxSessionSavingTokens += estimatedTokens;
        }
        report.skills.push({ name: skillName, sizeBytes, estimatedTokens, status, currentlyDisabled });
    }
    // Sort: excluded first (biggest wins), then by size desc within each group
    report.skills.sort((a, b) => {
        const order = { excluded: 0, unknown: 1, included: 2 };
        const od = order[a.status] - order[b.status];
        return od !== 0 ? od : b.estimatedTokens - a.estimatedTokens;
    });
    return report;
}
/**
 * Apply the skill filter to the plugin cache:
 * - Excluded/unknown skills: rename skill.md → skill.md.disabled
 * - Included skills: rename skill.md.disabled → skill.md (restore if previously disabled)
 *
 * Backs up any file before renaming. Idempotent — safe to run after every reinstall.
 * Pass `_cacheRoot` to override ~/.claude/plugins/cache (useful in tests).
 */
export function applySkillFilter(pluginName, skills, dryRun, _cacheRoot) {
    const report = reportSkillCosts(pluginName, skills, _cacheRoot);
    report.dryRun = dryRun;
    if (!report.cachePath || dryRun)
        return report;
    const skillsDir = join(report.cachePath, 'skills');
    let backupDir;
    for (const skill of report.skills) {
        const skillDir = join(skillsDir, skill.name);
        if (skill.status === 'excluded' || skill.status === 'unknown') {
            // Disable: rename active file to .disabled
            const active = findSkillFile(skillDir, false);
            if (active) {
                const bd = backupFile(active);
                if (bd && !backupDir)
                    backupDir = bd;
                renameSync(active, active + '.disabled');
            }
        }
        else {
            // Restore: rename .disabled back to active
            const disabled = findSkillFile(skillDir, true);
            if (disabled) {
                const restored = disabled.replace(/\.disabled$/, '');
                renameSync(disabled, restored);
            }
        }
    }
    report.applied = true;
    report.backupDir = backupDir;
    return report;
}
// ── Internal ───────────────────────────────────────────────────────────────────
/** Find skill.md or SKILL.md inside a skill directory. */
function findSkillFile(skillDir, disabled) {
    const suffix = disabled ? '.disabled' : '';
    for (const name of ['skill.md', 'SKILL.md']) {
        const p = join(skillDir, name + suffix);
        if (existsSync(p))
            return p;
    }
    return null;
}
//# sourceMappingURL=skill-filter.js.map
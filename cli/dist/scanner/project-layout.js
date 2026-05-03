import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
function glob(dir, pattern) {
    if (!existsSync(dir))
        return [];
    try {
        return readdirSync(dir)
            .filter((f) => pattern.test(f))
            .map((f) => join(dir, f));
    }
    catch {
        return [];
    }
}
export function scanProjectLayout(cwd = process.cwd()) {
    const claudeDir = join(cwd, '.claude');
    const agentsDir = join(claudeDir, 'agents');
    const commandsDir = join(claudeDir, 'commands');
    const skillsDir = join(claudeDir, 'skills');
    // Collect skill files one level deep (skills/name/skill.md)
    const skillFiles = [];
    if (existsSync(skillsDir)) {
        try {
            const skillNames = readdirSync(skillsDir);
            for (const name of skillNames) {
                const skillMd = join(skillsDir, name, 'skill.md');
                const skillMdCap = join(skillsDir, name, 'SKILL.md');
                if (existsSync(skillMd))
                    skillFiles.push(skillMd);
                else if (existsSync(skillMdCap))
                    skillFiles.push(skillMdCap);
            }
        }
        catch {
            // ignore
        }
    }
    return {
        cwd,
        hasClaudeDir: existsSync(claudeDir),
        hasClaudeMd: existsSync(join(cwd, 'CLAUDE.md')),
        hasMcpJson: existsSync(join(cwd, '.mcp.json')),
        hasSettingsLocal: existsSync(join(claudeDir, 'settings.local.json')),
        hasHooksJson: existsSync(join(claudeDir, 'hooks', 'hooks.json')),
        agentFiles: glob(agentsDir, /\.md$/i),
        commandFiles: glob(commandsDir, /\.md$/i),
        skillFiles,
    };
}
//# sourceMappingURL=project-layout.js.map
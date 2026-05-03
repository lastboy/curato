import { parseArgs } from 'node:util';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { backupFile } from '../../patcher/backup.js';
import { getClaudeDir } from '../../utils/platform.js';
import { ok, info, dim, warn } from '../print.js';

const HELP = `
USAGE
  curato install-agent-guide [options]

OPTIONS
  --user       Write to ~/.claude/CLAUDE.md instead of project ./CLAUDE.md
  --dry-run    Preview without writing
  --help       Show this help

DESCRIPTION
  Appends the Curato agent-role guide into CLAUDE.md. Idempotent — the section
  is only added if not already present. Backs up existing CLAUDE.md before
  writing.

EXAMPLES
  curato install-agent-guide
  curato install-agent-guide --user
  curato install-agent-guide --dry-run
`;

const SECTION_MARKER = '## Agent Roles';

const GUIDE = `## Agent Roles

Use these roles to match the task before starting work.

### Architect

- Suggested model: \`opus\`
- Use for: design decisions, planning, tradeoff analysis, scope definition
- Expected output: plan, approach, risks, boundaries
- Avoid: jumping straight into implementation when requirements are still unclear

### Implementer

- Suggested model: \`sonnet\`
- Use for: feature work, bug fixes, refactors, tests, focused code changes
- Expected output: working code, updated tests, concise implementation notes
- Avoid: making large architecture decisions without first checking the intended plan

### Reviewer

- Suggested model: \`opus\`
- Use for: code review, regression review, release-readiness checks, test-gap detection
- Expected output: findings first, then residual risks, then short summary
- Avoid: silently fixing issues during review unless explicitly asked

### Debugger

- Suggested model: \`opus\`
- Use for: failing tests, runtime issues, broken integrations, unclear behavior
- Expected output: root cause, evidence, reproduction steps, likely fix path
- Avoid: guessing or proposing fixes without tracing the actual failure

### Explorer

- Suggested model: \`sonnet\`
- Use for: codebase search, impact analysis, file discovery, "where is this defined?"
- Expected output: factual summary with file references
- Avoid: changing files during a discovery-only task

## Working Rules

1. Pick one primary role per task.
2. Start with Architect when the shape of the change is still unclear.
3. Use Implementer when the plan is clear and the task is mostly execution.
4. Use Reviewer after meaningful changes, especially before merge or release.
5. Use Debugger when something is failing and the cause is not obvious.
6. Use Explorer for research before coding when the affected surface area is unknown.
`;

export async function installAgentGuide(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      user:      { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help:      { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) { console.log(HELP); return; }

  const userScope = values.user as boolean;
  const dryRun = values['dry-run'] as boolean;
  const targetDir = userScope ? getClaudeDir() : process.cwd();
  const targetPath = join(targetDir, 'CLAUDE.md');

  const before = existsSync(targetPath) ? readFileSync(targetPath, 'utf8') : '';

  if (before.includes(SECTION_MARKER)) {
    dim(`${targetPath}: "${SECTION_MARKER}" already present — nothing to do.`);
    return;
  }

  const after = before
    ? before.replace(/\s*$/, '') + '\n\n' + GUIDE
    : GUIDE;

  if (dryRun) {
    info(`dry-run: would ${before ? 'append to' : 'create'} ${targetPath}`);
    dim(`(${GUIDE.length} chars would be added)`);
    return;
  }

  if (before) {
    const backupDir = backupFile(targetPath);
    dim(`  backup: ${backupDir}`);
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, after, 'utf8');

  ok(`Wrote agent guide to ${targetPath}`);
  if (!userScope) info('Tip: use --user to install at ~/.claude/CLAUDE.md instead.');
  warn('Reload Claude Code for the new CLAUDE.md to take effect.');
}

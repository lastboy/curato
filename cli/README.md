# curato — developer guide

This package is the Node.js CLI and library that powers Curato. It has no MCP server. The Claude Code plugin in `../plugin/` calls this CLI via Bash.

## Build & run

```bash
npm install
npm run build          # tsc → dist/
npm run dev            # tsc --watch

# Run CLI from source (no build needed)
npx tsx src/cli/index.ts --help

# Install globally from local source
npm install -g .
curato --help
```

## Test

```bash
npm run test                  # all tests
npm run test:unit             # scanner + patcher tests only
npm run test:integration      # regression suite
```

Tests use `node:test` (built-in, no framework) and `mkdtemp` for isolation — they never touch `~/.claude`.

---

## Module map

```
src/
  cli/
    index.ts          Entry point — parses argv, routes to command
    print.ts          ANSI helpers: ok(), fail(), warn(), info(), bold(), dim(), line()
    commands/
      install.ts      curato install <plugin> [--exclude ...] [--include ...]
      uninstall.ts    curato uninstall <plugin>
      setup.ts        curato setup [--config path] [--dry-run]
      register-mcp.ts curato register-mcp <name> <cmd> [--args] [--env] [--scope]
      remove-mcp.ts   curato remove-mcp <name> [--dry-run]
      scan.ts         curato scan [--json]
      clear-cache.ts  curato clear-cache [--plugin] [--marketplace] [--dry-run]

  scanner/            Read-only — never mutates files
    node-runtime.ts   Node version, NVM, PATH
    claude-config.ts  ~/.claude/settings.json, ~/.claude.json, CLAUDE.md locations
    mcp-registry.ts   MCP servers from all registries (settings.json, .claude.json, .mcp.json)
    plugin-state.ts   Installed plugins in marketplace cache directories
    project-layout.ts .claude/ dir structure, CLAUDE.md, settings.local.json
    team-config.ts    Read + validate curato-setup.json; handles GitHub `extends` refs

  patcher/            Mutating — all writes go through backup() first
    mcp-registrar.ts  Add MCP entries to settings.json
    mcp-remover.ts    Remove MCP entries from all registries
    skill-filter.ts   Rename skill files .disabled / undo; estimate token savings
    json-merger.ts    safeMerge() — deep merge with target-wins + array dedup
    backup.ts         Copy file to ~/.curato-backups/<timestamp>/ before mutating
    file-writer.ts    Write modes: create-if-missing, append, overwrite (dry-run aware)

  utils/
    platform.ts       Cross-platform paths + claude binary name (claude vs claude.cmd)

  types.ts            All shared interfaces
  __tests__/          Unit and integration tests
```

---

## Key invariants

1. **Target wins on merge** — `safeMerge(existing, incoming)`: existing keys are never overwritten. Use this for all JSON config mutations.
2. **Backup before every write** — call `backupFile(path)` before any `writeFileSync`. Backups land in `~/.curato-backups/YYYYMMDD-HHmmss/`.
3. **`dryRun` is always explicit** — every mutating function takes a `dryRun: boolean` parameter. Never infer it.
4. **scanners return data, never throw** — scanner functions catch errors internally and return partial/empty results. CLI commands decide how to surface failures.
5. **No runtime dependencies** — `package.json` has no `dependencies`, only `devDependencies`. All imports use `node:*` built-ins. Keep it that way.

---

## Adding a new CLI command

1. Create `src/cli/commands/your-command.ts`:

```typescript
import { parseArgs } from 'node:util';
import { ok, fail, info } from '../print.js';

const HELP = `
USAGE
  curato your-command <arg> [options]

OPTIONS
  --dry-run   Preview without applying
  --help      Show this help
`;

export async function yourCommand(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      'dry-run': { type: 'boolean', default: false },
      help:      { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) { console.log(HELP); return; }
  // ...
}
```

2. Import and add a `case` in `src/cli/index.ts`:

```typescript
import { yourCommand } from './commands/your-command.js';
// in switch:
case 'your-command': await yourCommand(args); break;
```

3. Add the command to the `HELP` string in `src/cli/index.ts`.

4. If the command appears in the Claude Code plugin, add a command file in `../plugin/commands/your-command.md`:

```markdown
---
description: What your command does
allowed-tools: ["Bash", "AskUserQuestion"]
---

Run: `curato your-command`
```

---

## curato-setup.json schema (TypeScript)

Defined in `src/types.ts` as `TeamSetupConfig`:

```typescript
interface TeamSetupConfig {
  version: 1;
  extends?: string;                          // URL to a base config (GitHub raw URL)
  mcpServers?: Record<string, TeamMcpEntry>;
  plugins?: Array<string | TeamPluginEntry>;
  claudeMd?: {
    project?: TeamClaudeMdEntry;
    user?: TeamClaudeMdEntry;
  };
}

interface TeamMcpEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;              // ${VAR} expanded at setup time
  scope?: 'user' | 'project';               // default: 'user'
  enabled?: boolean;                         // default: true
}

interface TeamPluginEntry {
  name: string;
  enabled?: boolean;
  skills?: { include?: string[]; exclude?: string[] };
}

interface TeamClaudeMdEntry {
  mode: 'create-if-missing' | 'overwrite' | 'append-if-missing-section';
  section?: string;                          // dedup marker for append mode
  content: string;
}
```

### `extends` (config inheritance)

A config can extend another via a raw GitHub URL:

```json
{
  "version": 1,
  "extends": "https://raw.githubusercontent.com/myorg/config/main/curato-setup.json",
  "plugins": [
    { "name": "superpowers", "enabled": true }
  ]
}
```

The base config is fetched and merged first. Local keys override inherited ones (target wins). Useful for team → org hierarchy.

---

## Registries Curato writes to

| File | Scope | Used by |
|------|-------|---------|
| `~/.claude/settings.json` | user | VS Code extension |
| `~/.claude.json` | user | Claude Code CLI |
| `.claude/settings.local.json` | project | VS Code extension (project override) |
| `.mcp.json` | project | Claude Code CLI (project) |

When `scope: "user"`, Curato writes to both `settings.json` and `.claude.json`. When `scope: "project"`, it writes to `.mcp.json` in the current working directory.

---

## Skill filtering internals

Skills live in the plugin's cache directory:

```
~/.claude/plugins/cache/<marketplace>/<plugin>/skills/<skill-name>/skill.md
```

`applySkillFilter()` renames excluded skills to `skill.md.disabled`. Claude Code skips any file not named `skill.md` at startup, saving context tokens proportional to each skill's file size.

`findPluginCachePath()` searches across all marketplace directories to locate the plugin regardless of which marketplace installed it.

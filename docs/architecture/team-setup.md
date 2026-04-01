# Team Setup

How Curato standardizes Claude Code environments across teams and organizations.

## The Problem

Without a shared standard, every developer's Claude Code environment drifts:
- Different MCP servers installed (or the same ones configured differently)
- Different plugins with different versions
- Missing or inconsistent CLAUDE.md files
- No way to onboard a new developer to "the team's Claude setup" in one step

## The Solution

A single `curato-setup.json` file, committed to your repo, that declares what the team's Claude Code environment should look like.

```
Developer runs /setup-team
        │
        ▼
curato-setup.json (in project root)
        │
        ├── extends? ──► Fetches company-wide base from GitHub
        │                 Merges: local wins, arrays unioned
        │
        ▼
Applies:
  ├── mcpServers  → registered in VS Code + CLI
  ├── plugins     → installed (with optional skill filter)
  └── claudeMd    → created or appended
```

## Config Schema

```jsonc
{
  "version": 1,

  // Inherit from a company-wide config.
  // Fetches from GitHub raw content. Local keys override remote.
  "extends": "github:your-org/claude-setup",

  // MCP servers to register.
  "mcpServers": {
    "server-name": {
      "command": "/path/to/binary",
      "args": ["--flag", "value"],
      "env": { "KEY": "value" },
      "scope": "user" | "project"
    }
  },

  // Plugins to install. Simple string or object with skill filter.
  "plugins": [
    "plugin-name",
    {
      "name": "superpowers",
      "skills": {
        "include": ["skill-a", "skill-b"],
        "exclude": ["skill-c"]
      }
    }
  ],

  // CLAUDE.md content to scaffold.
  "claudeMd": {
    "project": {
      "mode": "create-if-missing",
      "content": "# Project\n\n..."
    },
    "user": {
      "mode": "append-if-missing-section",
      "section": "## Company Standards",
      "content": "## Company Standards\n\n..."
    }
  }
}
```

## Scope: `user` vs `project`

| Scope | Where it's registered | Who sees it | Use case |
|-------|----------------------|-------------|----------|
| `user` | `~/.claude/settings.json` + `~/.claude.json` | All projects for this user | Shared tools (Azure DevOps, GitHub, Slack) |
| `project` | `.mcp.json` in project root | Only this project | Project-specific tools (local dev server, DB) |

## Inheritance with `extends`

Teams within a company can share a base config while adding their own:

**Company config** (hosted at `github:acme/claude-setup`):
```json
{
  "version": 1,
  "mcpServers": {
    "company-tools": { "command": "npx", "args": ["@acme/mcp"], "scope": "user" }
  },
  "plugins": ["code-review"],
  "claudeMd": {
    "user": {
      "mode": "append-if-missing-section",
      "section": "## Acme Standards",
      "content": "## Acme Standards\n\nFollow the style guide at ..."
    }
  }
}
```

**Team config** (in team's repo):
```json
{
  "version": 1,
  "extends": "github:acme/claude-setup",
  "mcpServers": {
    "team-db": { "command": "node", "args": ["./tools/db-mcp.js"], "scope": "project" }
  },
  "plugins": ["superpowers"]
}
```

**Result after merge:**
- MCP servers: `company-tools` (from company) + `team-db` (from team)
- Plugins: `code-review` (from company) + `superpowers` (from team)
- CLAUDE.md: company standards appended to user CLAUDE.md

Merge rules:
- **Local keys win** over remote keys (safeMerge target-wins)
- **Arrays are unioned** with deduplication (plugins, args)
- **Objects are deep-merged** recursively
- **Nothing is ever deleted** — only additive

## Skill Filtering

Some plugins inject large amounts of context (skills) into every session. Curato can selectively disable skills to save tokens:

```json
{
  "plugins": [
    {
      "name": "superpowers",
      "skills": {
        "include": [
          "brainstorming",
          "writing-plans",
          "executing-plans",
          "systematic-debugging",
          "verification-before-completion",
          "requesting-code-review",
          "test-driven-development",
          "dispatching-parallel-agents",
          "using-superpowers"
        ],
        "exclude": [
          "writing-skills",
          "subagent-driven-development",
          "receiving-code-review",
          "using-git-worktrees",
          "finishing-a-development-branch"
        ]
      }
    }
  ]
}
```

How it works:
1. Curato finds the plugin's cache directory (`~/.claude/plugins/cache/`)
2. Skills in `exclude` (and any unknown skills) have their `skill.md` renamed to `skill.md.disabled`
3. Claude Code skips `.disabled` files when building its skill registry
4. Run `/compact` in Claude Code to refresh the skill list

The `exclude` list is kept in the config for documentation — so you can see what was disabled and move it back to `include` if needed.

## Usage Patterns

### Solo Developer

Commit `curato-setup.json` to your project. When you set up a new machine or a colleague clones the repo, they run `/setup-team` and get your exact environment.

### Team Lead

Create a `curato-setup.json` with the team's standard MCP servers, plugins, and CLAUDE.md. Commit it to the repo. New team members run one command to onboard.

### Platform / DevOps Engineer

Maintain a company-wide config in a dedicated GitHub repo. Teams point to it with `extends` and add their own overrides. Update the central config and teams pick up changes on next `/setup-team`.

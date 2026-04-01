# Curato

**Install once. Everything works.**

Curato is a dev environment manager for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). It scans, diagnoses, repairs, and standardizes your MCP servers, plugins, and project setup — so you can stop debugging your tools and start using them.

## Who is this for?

- **Solo devs** — run `/doctor` when Claude Code acts up. Curato finds and fixes the problem.
- **Team leads** — commit a `curato-setup.json` to your repo. Every developer gets the same MCP servers, plugins, and CLAUDE.md on first setup.
- **Platform / DevOps engineers** — maintain a company-wide config. Teams inherit and extend it. One command applies the standard.

## Quick Start

```bash
git clone git@github.com:lastboy/curato.git
cd curato
bash scripts/install.sh
```

That's it. Curato builds the MCP server, registers the plugin, and connects to Claude Code.

Verify it works:

```
/doctor
```

## What it does

### Environment Health

| Command | What it does |
|---------|-------------|
| `/doctor` | Full health check — scans Node, plugins, MCP servers, project setup. Offers to repair. |
| `/scan` | Read-only status snapshot. No changes, no prompts. |
| `/repair` | Interactive repair for broken setups. |
| `/smoke-test` | 7-step validation suite. |

### Team Setup

| Command | What it does |
|---------|-------------|
| `/setup-team` | Apply your team's `curato-setup.json` — installs MCP servers, plugins, CLAUDE.md content. |
| `/bootstrap-project` | Scaffold `.claude/`, `CLAUDE.md`, and `settings.local.json` in a new project. |

### MCP & Plugin Management

| Command | What it does |
|---------|-------------|
| `/remove-mcp` | Remove an MCP server from all registries. |
| `/remove-plugin` | Uninstall a plugin and clear its cache. |
| `/clear-cache` | Clean plugin cache — one plugin, one marketplace, or everything. |
| `/uninstall` | Full teardown — removes Curato and everything it installed. |

### Built-in Connectors

These demonstrate how Curato manages complex MCP setups. Each one handles the full install, registration, and verification cycle.

| Command | What it does |
|---------|-------------|
| `/setup-chrome-devtools` | Install and configure chrome-devtools-mcp. |
| `/connect-chrome` | Launch Chrome in debug mode and connect Claude. |
| `/connect-azure` | Register Azure DevOps MCP with proper auth in both registries. |

## Team Setup

Create a `curato-setup.json` in your project root:

```jsonc
{
  "version": 1,
  // Inherit from a company-wide config (optional)
  // "extends": "github:your-org/claude-setup",
  "mcpServers": {
    "your-mcp": {
      "command": "npx",
      "args": ["-y", "your-mcp-server"],
      "scope": "project"
    }
  },
  "plugins": ["superpowers"],
  "claudeMd": {
    "project": {
      "mode": "create-if-missing",
      "content": "# My Project\n\nProject standards here."
    }
  }
}
```

Then run `/setup-team`. Every developer on the team runs the same command and gets the same environment.

See [curato-setup.example.json](curato-setup.example.json) for the full schema.

## Architecture

Three layers:

```
plugin/       → Claude Code plugin (13 commands, 3 agents, 3 skills)
mcp-server/   → TypeScript MCP server (21 tools)
scripts/      → Standalone scripts (no Claude Code dependency)
```

The MCP server does the real work. The plugin provides the conversational UX. The scripts let you install and diagnose without Claude Code running.

## Development

```bash
cd mcp-server
npm install
npm run build
npm run test          # 128 tests
npm run test:unit     # scanner + patcher + tool tests
npm run test:integration  # server roundtrip + regression
```

## Key Guarantees

1. **Never deletes existing config** — all merges use target-wins semantics
2. **Backup before every write** — timestamped copies in `~/.curato-backups/`
3. **Dry-run is always explicit** — mutation tools require `dryRun: boolean`
4. **Tests never touch `~/.claude`** — all tests use temp directories

## Documentation

- [Architecture Overview](docs/architecture/overview.md) — how Curato is built and why
- [Tools Reference](docs/architecture/tools-reference.md) — all 21 MCP tools
- [Team Setup Guide](docs/architecture/team-setup.md) — config schema, inheritance, skill filtering
- [Roadmap](docs/plan/roadmap.md) — what's next

## Platform Support

- **macOS / Linux** — fully supported
- **Windows** — planned ([roadmap](docs/plan/roadmap.md#v030--windows-support))

## License

[MIT](LICENSE)

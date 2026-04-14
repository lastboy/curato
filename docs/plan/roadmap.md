# Roadmap

## v0.1.0 — Initial Release (current)

Core environment management for Claude Code on macOS and Linux.

### Delivered
- [x] Environment scanning (Node, plugins, MCP servers, project layout)
- [x] Doctor / repair cycle with dry-run and backup guarantees
- [x] Team setup via `curato-setup.json` with GitHub inheritance
- [x] Plugin skill filtering (include/exclude to reduce token usage)
- [x] MCP dual-registry management (VS Code + CLI)
- [x] Chrome DevTools connector
- [x] Azure DevOps connector
- [x] Smoke test suite (7 steps)
- [x] Project bootstrapping
- [x] Full uninstall
- [x] 128 tests, 0 failures

## v0.2.0 — Distribution & Onboarding

Make installation zero-effort.

### Planned
- [ ] npm package (`npx @lastboy/curato install`)
- [ ] Smart Node path resolution at install time — resolve absolute `node` binary path and hardcode in MCP registration to avoid nvm/PATH issues
- [ ] Post-install smoke test (automatic)
- [ ] `curato update` command — pull latest and re-register
- [ ] Improve README with screenshots / terminal recordings

## v0.3.0 — Windows Support

Full Windows support without requiring WSL.

See [WINDOWS-SUPPORT.md](WINDOWS-SUPPORT.md) for the full phased plan.

### Done
- [x] `platform.ts` — centralized cross-platform helpers (`claudeBin`, `whichCmd`, `pathSep`, `tmpDir`, `getClaudeDir`, `chromeCandidates`)
- [x] All Claude CLI subprocess calls use `claudeBin()`
- [x] Cross-platform test runner (`run-tests.js`) — no shell glob expansion
- [x] CI matrix: macOS + Linux + Windows (`windows-latest`)
- [x] Node.js equivalents for all shell scripts
- [x] Regression test coverage for all 21 MCP tools

### Remaining
- [ ] `chrome.ts` — remove `bash` dependency, cross-platform launcher script
- [ ] `mcp.ts` — replace `pkill` with Windows-safe process termination (verify process name first)
- [ ] Path centralization — ~9 files still use `join(homedir(), '.claude')` directly
- [ ] Fix scan messages referencing `bash scripts/install.sh`
- [ ] Real Windows machine smoke test (blocks "officially supported" label)

## v0.4.0 — More Connectors

Expand the built-in connector library.

### Ideas
- [ ] GitHub MCP connector
- [ ] Slack MCP connector
- [ ] PostgreSQL / database MCP connector
- [ ] Connector template — make it easy for contributors to add new ones

## Future

- [ ] `curato doctor --ci` — non-interactive mode for CI pipelines
- [ ] Config validation CLI — `curato validate curato-setup.json`
- [ ] Dashboard — web UI showing environment health across team members
- [ ] Plugin marketplace integration — discover and install connectors

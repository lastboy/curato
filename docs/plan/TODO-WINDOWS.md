# Windows Support TODO

Tracked here for when Mac validation is done and Windows work begins.

## Already Fixed
- [x] `which` → `where` in `mcp-registry.ts` (cross-platform binary resolution)
- [x] Absolute path detection handles Windows drive letters (`C:\...`)

## MCP Server (TypeScript) — Minor fixes needed

- [ ] **`node-runtime.ts`**: `execSafe('node --version')` works, but nvm detection uses
  `NVM_DIR` env var which is set by nvm-unix. On Windows, [nvm-windows](https://github.com/coreybutler/nvm-windows)
  sets `NVM_HOME` and `NVM_SYMLINK` instead. Update `scanNodeRuntime()` to check both.
- [ ] **`node-runtime.ts`**: PATH segment check for nvm shims uses `/nvm/` substring.
  On Windows nvm-windows the path looks like `C:\Users\user\AppData\Roaming\nvm\` — update
  the check in `pathContainsNvm`.
- [ ] **`smoketest/runner.ts`**: `spawn('node', ...)` — on Windows the binary may be
  `node.exe`. Node's `child_process` handles this automatically, but verify.
- [ ] **`tools/team.ts`**: `spawnSync('claude', ...)` — on Windows the Claude CLI is
  `claude.cmd`. Replace with a helper that appends `.cmd` on `process.platform === 'win32'`.

## Paths

- [ ] `scanner/claude-config.ts`: `getClaudeDir()` uses `homedir()` which returns
  `C:\Users\username` on Windows. Claude Code stores config at
  `%APPDATA%\Claude` or `%USERPROFILE%\.claude` — verify which one Claude Code
  uses on Windows and update accordingly.
- [ ] `patcher/backup.ts`: backup dir `~/.curato-backups/` — verify this resolves
  correctly on Windows via `homedir()`.

## Testing

- [ ] Run full test suite on Windows (all tests use `mkdtempSync` so should be portable)
- [ ] Verify `npm run build` and `npm run test` pass on Windows
- [ ] Manual smoke test: `/doctor`, `/setup-team`, `/smoke-test` in VS Code on Windows

## WSL Interim Workaround (document in README)

Until native Windows scripts exist, Windows users can use WSL:

```powershell
# Install WSL if needed
wsl --install

# Then run all bash scripts inside WSL
wsl bash scripts/install.sh
wsl bash scripts/doctor.sh
```

The MCP server itself runs natively on Windows — only the install/setup scripts need WSL.

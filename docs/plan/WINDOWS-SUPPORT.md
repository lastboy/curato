# Windows Support Plan

## Goal

Make Curato work on Windows without requiring bash, Unix-only commands, or Unix-specific paths.

**Success definition:**
- MCP server works on macOS, Linux, and Windows
- All user-facing setup flows use Node.js scripts (no bash required)
- Platform-specific behavior goes through one shared utility module
- All existing features have regression test coverage
- A real Windows machine smoke test passes

---

## Current Status: `feat/windows-fixes` (pending merge)

> "Windows implementation in progress. CI simulation passes. Real Windows validation pending."

---

## Phases

### Phase 0 — Regression test coverage  ✅ DONE (this PR adds it)

Before any further Windows work, every tool must have tests to prevent regressions for existing Mac/Linux users.

**Gaps closed:**

| Area | New tests |
|---|---|
| `scanner/claude-config.ts` | `readSettingsJson`, `readClaudeJson`, `scanUserSetup`, `findClaudeMdUp` |
| `tools/inspect.ts` | `inspect_user_setup`, `inspect_project_setup` |
| `tools/mcp.ts` | `check_mcp_registration`, `register_mcp_both` dryRun, `remove_mcp_server` live + dryRun |
| `tools/plugin.ts` | `check_plugin_state`, `remove_plugin` dryRun, `clear_plugin_cache` dryRun |
| `tools/uninstall.ts` | `uninstall_curato` dryRun (destructive live path is covered by patcher tests) |
| `tools/recommend.ts` | `buildRepairProposals` logic, `recommend_setup` tool dispatch |

**Still no tests (deferred — subprocess-heavy, low regression risk for existing users):**
- `tools/chrome.ts` — complex subprocess logic; tested manually
- `tools/team.ts` — requires network (`fetchGithubConfig`) and real Claude CLI

---

### Phase 1 — CI and test infrastructure  ✅ DONE (feat/windows-fixes)

- [x] `run-tests.js` — cross-platform test runner (replaces shell glob expansion)
- [x] `package.json` test scripts updated to use `run-tests.js`
- [x] CI matrix: `ubuntu-latest`, `macos-latest`, `windows-latest`
- [x] `basename()` replaces `split('/')` in smoketest assertions
- [x] `whichCmd()` centralized in `mcp-registry.ts`

---

### Phase 2 — Platform utility module  ✅ DONE (prior to feat/windows-fixes)

`mcp-server/src/utils/platform.ts` is the single source of truth for all platform branching:

| Export | Windows | Unix/macOS |
|---|---|---|
| `isWin()` | `true` | `false` |
| `claudeBin()` | `claude.cmd` | `claude` |
| `whichCmd()` | `where` | `which` |
| `pathSep()` | `;` | `:` |
| `tmpDir()` | `os.tmpdir()` | `os.tmpdir()` |
| `getClaudeDir()` | `%APPDATA%/Claude` (fallback: `~/.claude`) | `~/.claude` |
| `getClaudeJsonPath()` | `~/.claude.json` (provisional — needs real Windows check) | `~/.claude.json` |
| `chromeCandidates()` | `Program Files` paths | macOS app bundle / Linux commands |

All subprocess calls to the Claude CLI already use `claudeBin()`.

---

### Phase 3 — bash removal from `chrome.ts`  ⬜ OPEN

`tools/chrome.ts` still has direct bash dependencies that will break on Windows:

**Problems:**
- Line 121: generates a `#!/bin/bash` launcher script
- Line 360: `spawn('bash', [launcher], ...)` — hard fails on Windows (no bash)
- Lines 77, 269: `join(homedir(), '.claude.json')` and `join(homedir(), '.claude', 'settings.json')` — should use `getClaudeDir()` / `getClaudeJsonPath()`
- `/tmp/chrome-debug-profile` hardcoded — should use `tmpDir()`

**Required changes:**
1. Replace `#!/bin/bash` launcher with a cross-platform `.js` script using `spawn('node', [launcherJs])`
2. Replace `spawn('bash', ...)` with `spawn('node', ...)`
3. Replace path constructions with `getClaudeDir()` / `getClaudeJsonPath()` / `tmpDir()`
4. Guard `chmodSync` behind `!isWin()` (Windows does not use chmod)

---

### Phase 4 — `pkill` removal from `mcp.ts`  ⬜ OPEN

`tools/mcp.ts` `launch_azure_auth` uses `pkill` on Unix with no equivalent on Windows.

Current state: Windows branch calls `taskkill /F /IM mcp-server-azuredevops.exe` but the exact
process name on Windows has not been verified on a real machine.

**Required changes:**
1. Confirm the actual process name on Windows
2. If confirmed: remove the TODO comment and validate the `taskkill` command
3. If unconfirmed: document as provisional with a clear error message for Windows users

---

### Phase 5 — Path centralization in remaining tools  ⬜ OPEN (lower priority)

These files still construct `~/.claude` paths manually instead of using `getClaudeDir()`.
On Unix/macOS the result is identical today, so this is not a regression risk for current users.
It becomes required before claiming full Windows support.

**Files to update:**

| File | Usage |
|---|---|
| `tools/mcp.ts` | `join(homedir(), '.claude.json')` → `getClaudeJsonPath()` |
| `tools/plugin.ts` | `join(homedir(), '.claude', 'plugins', ...)` → `join(getClaudeDir(), 'plugins', ...)` |
| `tools/uninstall.ts` | Multiple `join(home, '.claude', ...)` → `getClaudeDir()` |
| `tools/recommend.ts` | Multiple path constructions → `getClaudeDir()` |
| `tools/team.ts` | Multiple path constructions → `getClaudeDir()` |
| `patcher/mcp-remover.ts` | Default path args → `getClaudeDir()` |
| `patcher/mcp-registrar.ts` | Default path args → `getClaudeDir()` |
| `patcher/skill-filter.ts` | `cacheRoot` default → `getClaudeDir()` |
| `scanner/plugin-state.ts` | `marketplacesDir` → `getClaudeDir()` |

---

### Phase 6 — Fix user-facing messages referencing bash  ⬜ OPEN

`tools/scan.ts` lines 180 and 273 suggest `bash scripts/install.sh` in repair hints.
These should point to the Node.js equivalents:

```
'Run: node scripts/install.js'
```

---

### Phase 7 — Real Windows validation  ⬜ BLOCKED (needs machine)

The following must pass on an actual Windows machine before Windows support is declared complete:

1. `node scripts/install.js` — registers Curato MCP server
2. `node scripts/doctor.js` — runs environment scan
3. Claude CLI registration works with `claude.cmd`
4. Curato MCP server is registered and scanned correctly
5. Chrome DevTools launcher works (or fails with a clear actionable error)
6. A basic `/doctor` or `/scan` command runs end-to-end

**Record findings:** exact OS version, Node version, any errors, and whether each step passed or needed a fix. Document in a follow-up file or PR description.

---

## Suggested PR order

| PR | Phase | Status |
|---|---|---|
| `feat/windows-fixes` | Phase 0 + Phase 1 | Ready to merge |
| `feat/chrome-cross-platform` | Phase 3 | Next after merge |
| `feat/fix-pkill-windows` | Phase 4 | Alongside Phase 3 |
| `feat/fix-scan-messages` | Phase 6 | Small — can bundle with Phase 3 |
| `feat/path-centralization` | Phase 5 | After Phase 3+4 |
| Real Windows smoke test | Phase 7 | Whenever machine is available |

---

## Acceptance criteria for "Windows Supported" label

- All phases 0–6 merged
- Phase 7 real-machine smoke test recorded and passing
- No remaining `#!/bin/bash`, `spawn('bash', ...)`, or `pkill` in maintained production code
- All maintained user flows documented with Node.js entry points

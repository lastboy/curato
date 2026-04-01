# Windows Support + Shell -> Node.js Implementation Spec

## Goal

Make Curato work on Windows without requiring bash, Unix-only commands, or Unix-specific file paths.

Success means:
- the MCP server works on macOS, Linux, and Windows
- setup and maintenance scripts have a Node.js implementation
- Windows-specific path and executable handling are centralized
- the project can be validated mostly on macOS/Linux with platform overrides
- at least one short real-Windows smoke test is still required before calling the work complete

This document replaces [`TODO-WINDOWS.md`](./TODO-WINDOWS.md).

---

## Non-Goals

- Do not redesign Curato’s feature set
- Do not remove existing `.sh` scripts immediately if they are still useful for Unix users
- Do not assume a Windows machine is available during day-to-day development
- Do not claim Windows support is complete until a real Windows smoke test passes

---

## Required Outcome

After this work:

1. A Windows user can install and run Curato without `bash`, `which`, `pkill`, or `/tmp`.
2. All code that depends on OS-specific behavior goes through one shared platform utility module.
3. All Claude config file locations are resolved through helpers rather than ad hoc `join(homedir(), '.claude', ...)`.
4. All subprocess calls to the Claude CLI use a helper that resolves `claude.cmd` on Windows.
5. All maintained scripts that users are expected to run have a Node.js path.
6. Automated tests cover Windows-specific branching logic.
7. A manual smoke test is run on an actual Windows machine before the project is declared supported.

---

## Current Gaps To Fix

The current repo has four classes of Windows blockers:

1. Unix-only subprocess assumptions
- `which`
- `pkill`
- `bash`
- direct `claude` instead of `claude.cmd`

2. Unix-only path assumptions
- `~/.claude`
- `/tmp/...`
- `PATH` split on `:`
- string-based absolute-path checks like `startsWith('/')`

3. Shell-script dependency
- `scripts/*.sh`
- `chrome-debug.sh`

4. Incomplete centralization
- multiple files still resolve Claude config paths directly instead of through a shared helper

---

## Source Of Truth

Create a new platform utility module:

- [`mcp-server/src/utils/platform.ts`](/Users/arik/dev/curato/mcp-server/src/utils/platform.ts)

This file becomes the only place that:
- branches on `win32`
- decides which executable names to spawn
- defines path separator behavior
- defines temp directory behavior
- resolves Claude config locations
- provides Chrome candidate paths

No other production file should hardcode `process.platform === 'win32'` unless there is a clear one-off reason.

---

## Platform Utility Contract

`platform.ts` must export:

```ts
export let _platform: NodeJS.Platform;

export function setPlatformOverride(platform: NodeJS.Platform): void;
export function resetPlatformOverride(): void;

export function isWin(): boolean;
export function claudeBin(): string;
export function whichCmd(): string;
export function pathSep(): string;
export function tmpDir(): string;

export function getClaudeDir(): string;
export function getClaudeJsonPath(): string;

export function chromeCandidates(): string[];
```

Behavior:

- `claudeBin()`
  - Windows: `claude.cmd`
  - other platforms: `claude`

- `whichCmd()`
  - Windows: `where`
  - other platforms: `which`

- `pathSep()`
  - Windows: `;`
  - other platforms: `:`

- `tmpDir()`
  - wraps `os.tmpdir()`

- `getClaudeDir()`
  - default Unix/macOS: `join(homedir(), '.claude')`
  - Windows: prefer `%APPDATA%/Claude` if it exists
  - Windows fallback: `join(homedir(), '.claude')`

- `getClaudeJsonPath()`
  - `join(homedir(), '.claude.json')`
  - leave a short comment noting this path must be confirmed by real-Windows testing

- `chromeCandidates()`
  - macOS: app bundle path
  - Windows: `Program Files` and `Program Files (x86)` candidates
  - Linux: candidates discovered via `which`

Testing behavior:

- `_platform` must be overridable for tests
- production code must read from the helper, not from `process.platform` directly

---

## Required Production Changes

### 1. Claude config path centralization

The following files must stop hardcoding `join(homedir(), '.claude', ...)` and instead use `getClaudeDir()` and `getClaudeJsonPath()` where appropriate:

- [`mcp-server/src/scanner/claude-config.ts`](/Users/arik/dev/curato/mcp-server/src/scanner/claude-config.ts)
- [`mcp-server/src/scanner/plugin-state.ts`](/Users/arik/dev/curato/mcp-server/src/scanner/plugin-state.ts)
- [`mcp-server/src/scanner/mcp-registry.ts`](/Users/arik/dev/curato/mcp-server/src/scanner/mcp-registry.ts)
- [`mcp-server/src/patcher/mcp-registrar.ts`](/Users/arik/dev/curato/mcp-server/src/patcher/mcp-registrar.ts)
- [`mcp-server/src/patcher/mcp-remover.ts`](/Users/arik/dev/curato/mcp-server/src/patcher/mcp-remover.ts)
- [`mcp-server/src/patcher/skill-filter.ts`](/Users/arik/dev/curato/mcp-server/src/patcher/skill-filter.ts)
- [`mcp-server/src/tools/chrome.ts`](/Users/arik/dev/curato/mcp-server/src/tools/chrome.ts)
- [`mcp-server/src/tools/plugin.ts`](/Users/arik/dev/curato/mcp-server/src/tools/plugin.ts)
- [`mcp-server/src/tools/team.ts`](/Users/arik/dev/curato/mcp-server/src/tools/team.ts)
- [`mcp-server/src/tools/uninstall.ts`](/Users/arik/dev/curato/mcp-server/src/tools/uninstall.ts)
- [`scripts/register-mcp.js`](/Users/arik/dev/curato/scripts/register-mcp.js) if this script remains in use

Definition of done:
- no production code outside `platform.ts` should need to know the Windows Claude config directory convention

### 2. Claude CLI subprocess centralization

Every subprocess invocation of the Claude CLI must use `claudeBin()`.

That includes both direct spawns and stored command arrays.

Known files to update:

- [`mcp-server/src/tools/team.ts`](/Users/arik/dev/curato/mcp-server/src/tools/team.ts)
- [`mcp-server/src/tools/plugin.ts`](/Users/arik/dev/curato/mcp-server/src/tools/plugin.ts)
- [`mcp-server/src/tools/uninstall.ts`](/Users/arik/dev/curato/mcp-server/src/tools/uninstall.ts)
- [`mcp-server/src/tools/scan.ts`](/Users/arik/dev/curato/mcp-server/src/tools/scan.ts)
- [`mcp-server/src/tools/apply.ts`](/Users/arik/dev/curato/mcp-server/src/tools/apply.ts)
- [`mcp-server/src/tools/chrome.ts`](/Users/arik/dev/curato/mcp-server/src/tools/chrome.ts)

And specifically in [`mcp-server/src/tools/team.ts`](/Users/arik/dev/curato/mcp-server/src/tools/team.ts):
- `spawnSync('claude', ...)` must change
- proposal payloads like `['claude', 'plugin', 'install', ...]` must also change

Definition of done:
- searching for `spawnSync('claude'` and `['claude',` in maintained production code should return zero Windows-relevant call sites

### 3. `scanner/node-runtime.ts`

Update [`mcp-server/src/scanner/node-runtime.ts`](/Users/arik/dev/curato/mcp-server/src/scanner/node-runtime.ts) to:

- replace `which node` with `${whichCmd()} node`
- support both `NVM_DIR` and `NVM_HOME`
- split `PATH` using `pathSep()`
- detect Windows-style nvm path segments such as `\\nvm\\`
- keep behavior safe if neither Unix nvm nor nvm-windows is present

Important:
- do not over-promise current-version detection for nvm-windows unless the implementation is actually reliable
- if “current version” cannot be determined cleanly on Windows, return `undefined` rather than guessing

### 4. `tools/chrome.ts`

Update [`mcp-server/src/tools/chrome.ts`](/Users/arik/dev/curato/mcp-server/src/tools/chrome.ts) to:

- replace `new URL(import.meta.url).pathname` with `fileURLToPath(import.meta.url)`
- replace hardcoded macOS Chrome paths with `chromeCandidates()`
- replace `/tmp/chrome-debug-profile` with `join(tmpDir(), 'chrome-debug-profile')`
- guard `chmodSync` on Windows
- stop requiring `bash`
- support both `chrome-debug.js` and `chrome-debug.sh` discovery during transition
- use `claudeBin()` for `claude mcp add`

Definition of done:
- the tool can launch Chrome without bash
- the tool can create a launcher on every platform
- the tool does not fail on Windows-specific path handling

### 5. `tools/mcp.ts`

Update [`mcp-server/src/tools/mcp.ts`](/Users/arik/dev/curato/mcp-server/src/tools/mcp.ts) to replace Unix-only process termination logic.

Requirements:
- keep Unix behavior working
- add a Windows path that does not assume `pkill`
- do not hardcode an executable name unless it has been confirmed in practice

Preferred implementation:
- first confirm how the Azure DevOps MCP process is actually named on Windows
- if that cannot be confirmed yet, document the Windows branch as provisional and add a TODO

### 6. `tools/recommend.ts`

Update [`mcp-server/src/tools/recommend.ts`](/Users/arik/dev/curato/mcp-server/src/tools/recommend.ts) to:

- use `pathSep()`
- use a Windows-safe fallback PATH
- avoid Unix-only assumptions when constructing `env.PATH`

### 7. `tools/scan.ts`

Update [`mcp-server/src/tools/scan.ts`](/Users/arik/dev/curato/mcp-server/src/tools/scan.ts) to:

- use `path.isAbsolute()`
- use `path.basename()`
- use `claudeBin()` for CLI inspection commands

### 8. `scanner/team-config.ts`

Update [`mcp-server/src/scanner/team-config.ts`](/Users/arik/dev/curato/mcp-server/src/scanner/team-config.ts) so path parsing does not assume `/`.

At minimum:
- replace manual `split('/')` parsing in GitHub ref handling with logic that remains safe for Windows path semantics

Note:
- the `github:org/repo/...` format is not a filesystem path, so this is lower risk than the other items, but the implementation should still avoid needless path-style assumptions where practical

### 9. `scripts/register-mcp.js`

This file is already Node-based, but it still needs review for Windows safety if it remains part of the install flow.

Required fixes if kept:
- default config path must come from a shared helper or equivalent logic
- `mkdirSync(join(configPath, '..'))` must be corrected to `mkdirSync(dirname(configPath))`

If this script will be replaced by another Node installer path, say so explicitly in the implementation and remove it from the supported flow.

---

## Script Migration Requirements

Node.js versions of the following scripts must exist:

- [`scripts/install.js`](/Users/arik/dev/curato/scripts/install.js)
- [`scripts/doctor.js`](/Users/arik/dev/curato/scripts/doctor.js)
- [`scripts/init-team.js`](/Users/arik/dev/curato/scripts/init-team.js)
- [`scripts/smoke-test.js`](/Users/arik/dev/curato/scripts/smoke-test.js)
- [`scripts/bootstrap-project.js`](/Users/arik/dev/curato/scripts/bootstrap-project.js)
- [`scripts/uninstall.js`](/Users/arik/dev/curato/scripts/uninstall.js)
- [`chrome-debug.js`](/Users/arik/dev/curato/chrome-debug.js)

The existing `.sh` scripts may remain temporarily for Unix users, but:
- docs must point users to the `.js` versions as the supported cross-platform entrypoint
- new behavior must be implemented in Node first, not bash first

All Node scripts must:
- use `path.join()` and `dirname()`
- use `spawnSync()` or `spawn()` without bash wrappers
- use `claudeBin()` for Claude CLI subprocesses
- avoid `cp -r`, `mkdir -p`, `grep`, `sed`, `head`, and similar shell utilities
- use `fs` and JavaScript/TypeScript JSON handling instead

The script migration should also cover current bash-only behavior in:
- [`scripts/install.sh`](/Users/arik/dev/curato/scripts/install.sh)
- [`scripts/doctor.sh`](/Users/arik/dev/curato/scripts/doctor.sh)
- [`scripts/init-team.sh`](/Users/arik/dev/curato/scripts/init-team.sh)
- [`scripts/smoke-test.sh`](/Users/arik/dev/curato/scripts/smoke-test.sh)
- [`scripts/bootstrap-project.sh`](/Users/arik/dev/curato/scripts/bootstrap-project.sh)
- [`scripts/uninstall.sh`](/Users/arik/dev/curato/scripts/uninstall.sh)
- [`chrome-debug.sh`](/Users/arik/dev/curato/chrome-debug.sh)

---

## Acceptance Criteria

The work is not complete until all of the following are true.

### Code criteria

- There is exactly one platform utility module for Windows branching
- all maintained Windows-relevant subprocess calls use helper-based executable resolution
- all maintained Windows-relevant Claude config paths use helper-based path resolution
- there are no remaining hardcoded `/tmp/...` usages in production code that affect Windows paths
- there are no remaining production bash dependencies in supported flows

### Test criteria

- automated tests cover platform helper behavior
- automated tests cover Windows-oriented `node-runtime` scenarios
- automated tests cover at least one Windows path-resolution case for Claude config lookup
- automated tests cover `claude.cmd` selection behavior
- automated tests cover Chrome candidate selection behavior

### Documentation criteria

- user-facing docs point to Node-based scripts where relevant
- any still-unverified Windows assumptions are marked explicitly as provisional

### Validation criteria

- macOS/Linux build and tests pass
- Node-based scripts run successfully on a Unix machine
- at least one manual Windows smoke test is executed and recorded

---

## Verification Plan

### Automated verification on macOS/Linux

```bash
cd mcp-server
npm run build
npm run test
```

```bash
node scripts/install.js
node scripts/doctor.js
node scripts/smoke-test.js
```

### Windows-simulation verification

Add tests that use `setPlatformOverride('win32')` to verify:

- `claudeBin()` returns `claude.cmd`
- `whichCmd()` returns `where`
- `pathSep()` returns `;`
- `getClaudeDir()` prefers `%APPDATA%/Claude` when present
- `getClaudeDir()` falls back safely when it is not
- Windows Chrome candidates are returned
- Windows nvm path parsing behaves correctly

### Required real-Windows smoke test

Before calling the feature complete, run these checks on an actual Windows machine:

1. `node scripts/install.js`
2. `node scripts/doctor.js`
3. Claude CLI registration works with `claude.cmd`
4. Curato MCP server can be registered and detected
5. Chrome launcher path works or fails with a clear actionable error
6. A basic Curato command runs successfully

Record the exact findings in the PR or follow-up doc.

---

## Suggested Execution Order

1. Add `platform.ts` and tests for it.
2. Centralize Claude config path resolution.
3. Centralize Claude CLI subprocess resolution.
4. Fix `node-runtime.ts`, `scan.ts`, `recommend.ts`, and `chrome.ts`.
5. Fix `tools/mcp.ts` with a clearly documented Windows branch.
6. Migrate user-facing scripts to Node.js.
7. Update docs to point to the Node.js entrypoints.
8. Run automated verification.
9. Run a real Windows smoke test.

---

## Definition Of Complete

This project should only be described as having Windows support when:

- the code changes above are merged
- automated tests pass
- supported setup flows no longer depend on bash
- unresolved Windows assumptions are either verified or called out explicitly
- a real Windows smoke test has succeeded

Until then, the correct status is:

"Windows implementation in progress; simulation tests pass, real Windows validation pending."

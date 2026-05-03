const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
// Line printers — each writes one line to stdout/stderr.
export function ok(msg) { console.log(`${GREEN}✓${RESET} ${msg}`); }
export function fail(msg) { console.error(`${RED}✗${RESET} ${msg}`); }
export function warn(msg) { console.log(`${YELLOW}!${RESET} ${msg}`); }
export function info(msg) { console.log(`${DIM}→${RESET} ${msg}`); }
export function bold(msg) { console.log(`${BOLD}${msg}${RESET}`); }
export function dim(msg) { console.log(`${DIM}${msg}${RESET}`); }
export function line() { console.log(); }
// Pure string transforms — safe to use inside template literals without side effects.
export function boldStr(msg) { return `${BOLD}${msg}${RESET}`; }
export function dimStr(msg) { return `${DIM}${msg}${RESET}`; }
//# sourceMappingURL=print.js.map
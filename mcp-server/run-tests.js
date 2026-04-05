#!/usr/bin/env node
// Cross-platform test runner — expands glob patterns that cmd.exe can't handle.
// Usage: node run-tests.js <glob> [<glob> ...]
import { globSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const patterns = process.argv.slice(2);
if (patterns.length === 0) {
  console.error('Usage: node run-tests.js <glob> [<glob> ...]');
  process.exit(1);
}

const files = patterns.flatMap((p) => globSync(p));
if (files.length === 0) {
  console.error('No test files matched:', patterns.join(', '));
  process.exit(1);
}

try {
  execFileSync('node', ['--import', 'tsx/esm', '--test', ...files], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
} catch {
  process.exit(1);
}

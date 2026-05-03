#!/usr/bin/env node
// Cross-platform test runner — expands glob patterns that cmd.exe can't handle.
// Uses recursive readdirSync (Node >= 18.17) instead of globSync (Node >= 22).
// Usage: node run-tests.js <pattern> [<pattern> ...]
//
// Supported pattern syntax: path/to/dir/**/*.test.ts
// The `**` is replaced with a recursive directory search.

import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

function matchPattern(pattern) {
  // Split on ** to get the prefix dir and the suffix glob (e.g. *.test.ts)
  const starIdx = pattern.indexOf('**');
  if (starIdx === -1) return [pattern]; // no glob — treat as literal file

  const baseDir = pattern.slice(0, starIdx).replace(/[/\\]$/, '') || '.';
  const suffix = pattern.slice(starIdx + 3); // strip '**/'
  const ext = suffix.replace(/^\*/, '');     // e.g. '.test.ts'

  let files;
  try {
    files = readdirSync(baseDir, { recursive: true, encoding: 'utf8' });
  } catch {
    return [];
  }

  return files
    .filter((f) => f.endsWith(ext))
    .map((f) => join(baseDir, f));
}

const patterns = process.argv.slice(2);
if (patterns.length === 0) {
  console.error('Usage: node run-tests.js <pattern> [<pattern> ...]');
  process.exit(1);
}

const files = patterns.flatMap(matchPattern).map((f) => resolve(f));
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

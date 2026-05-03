#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cli = join(__dirname, '..', 'cli', 'dist', 'cli', 'index.js');

const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);

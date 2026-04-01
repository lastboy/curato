#!/usr/bin/env node
// bootstrap-project.js — Cross-platform replacement for bootstrap-project.sh
// Usage: node bootstrap-project.js [target-dir]

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] ?? process.cwd();

console.log(`Bootstrapping Claude Code setup for: ${target}\n`);

let created = 0;

// ── .claude/ directory ───────────────────────────────────────────────────────

const claudeDir = join(target, '.claude');
if (!existsSync(claudeDir)) {
  mkdirSync(join(claudeDir, 'agents'), { recursive: true });
  mkdirSync(join(claudeDir, 'commands'), { recursive: true });
  mkdirSync(join(claudeDir, 'skills'), { recursive: true });
  console.log(`  [created] ${claudeDir}/`);
  created++;
} else {
  console.log(`  [skip]    ${claudeDir}/ already exists`);
}

// ── .claude/settings.local.json ──────────────────────────────────────────────

const settingsLocal = join(claudeDir, 'settings.local.json');
if (!existsSync(settingsLocal)) {
  writeFileSync(settingsLocal, '{}\n', 'utf8');
  console.log(`  [created] ${settingsLocal}`);
  created++;
} else {
  console.log(`  [skip]    ${settingsLocal} already exists`);
}

// ── CLAUDE.md ─────────────────────────────────────────────────────────────────

const claudeMd = join(target, 'CLAUDE.md');
if (!existsSync(claudeMd)) {
  const projectName = basename(target);
  const content = `# ${projectName}

## Overview
<!-- Describe what this project is -->

## Architecture
<!-- Key architectural decisions and structure -->

## Commands
<!-- Custom slash commands available in this project -->

## Stack
<!-- Tech stack and key dependencies -->

## Conventions
<!-- Code style, patterns, and conventions to follow -->
`;
  writeFileSync(claudeMd, content, 'utf8');
  console.log(`  [created] ${claudeMd}`);
  created++;
} else {
  console.log(`  [skip]    ${claudeMd} already exists`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('');
if (created > 0) {
  console.log(`Created ${created} file(s). Project is ready for Claude Code.`);
} else {
  console.log('Curato: project already has Claude Code setup. Nothing to do.');
}

#!/usr/bin/env bash
# Curato — bootstrap a project with a minimal Claude Code setup
# Usage: bash bootstrap-project.sh [target-dir]

set -euo pipefail

TARGET="${1:-$(pwd)}"
CURATO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Bootstrapping Claude Code setup for: $TARGET"
echo ""

CREATED=0

# ── .claude/ directory ─────────────────────────────────────────────────────────

CLAUDE_DIR="$TARGET/.claude"
if [ ! -d "$CLAUDE_DIR" ]; then
  mkdir -p "$CLAUDE_DIR/agents" "$CLAUDE_DIR/commands" "$CLAUDE_DIR/skills"
  echo "  [created] $CLAUDE_DIR/"
  CREATED=$((CREATED+1))
else
  echo "  [skip]    $CLAUDE_DIR/ already exists"
fi

# ── .claude/settings.local.json ────────────────────────────────────────────────

SETTINGS_LOCAL="$CLAUDE_DIR/settings.local.json"
if [ ! -f "$SETTINGS_LOCAL" ]; then
  echo '{}' > "$SETTINGS_LOCAL"
  echo "  [created] $SETTINGS_LOCAL"
  CREATED=$((CREATED+1))
else
  echo "  [skip]    $SETTINGS_LOCAL already exists"
fi

# ── CLAUDE.md ─────────────────────────────────────────────────────────────────

CLAUDE_MD="$TARGET/CLAUDE.md"
if [ ! -f "$CLAUDE_MD" ]; then
  PROJECT_NAME=$(basename "$TARGET")
  cat > "$CLAUDE_MD" << HEREDOC
# $PROJECT_NAME

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
HEREDOC
  echo "  [created] $CLAUDE_MD"
  CREATED=$((CREATED+1))
else
  echo "  [skip]    $CLAUDE_MD already exists"
fi

# ── Summary ────────────────────────────────────────────────────────────────────

echo ""
if [ "$CREATED" -gt 0 ]; then
  echo "Created $CREATED file(s). Project is ready for Claude Code."
else
  echo "Curato: project already has Claude Code setup. Nothing to do."
fi

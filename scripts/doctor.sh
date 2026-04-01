#!/usr/bin/env bash
# Curato — standalone doctor script (no MCP, no Claude Code required)
# Run this to diagnose a broken environment before Claude Code can help.

CURATO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
WARN=0
FAIL=0

ok()   { echo "  [OK]   $1"; PASS=$((PASS+1)); }
warn() { echo "  [WARN] $1"; WARN=$((WARN+1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

echo "=== Curato Doctor ==="
echo ""

# ── Node.js ───────────────────────────────────────────────────────────────────

NODE_VER=$(node --version 2>/dev/null || echo "")
if [ -z "$NODE_VER" ]; then
  fail "Node.js not found in PATH"
else
  MAJOR=$(echo "$NODE_VER" | sed 's/v\([0-9]*\).*/\1/')
  if [ "$MAJOR" -ge 18 ]; then
    ok "Node.js $NODE_VER (>= 18 required)"
  else
    fail "Node.js $NODE_VER — version 18+ required"
  fi
fi

# ── npm ────────────────────────────────────────────────────────────────────────

NPM_VER=$(npm --version 2>/dev/null || echo "")
if [ -z "$NPM_VER" ]; then
  warn "npm not found"
else
  ok "npm $NPM_VER"
fi

# ── Claude Code ───────────────────────────────────────────────────────────────

CLAUDE_VER=$(claude --version 2>/dev/null || echo "")
if [ -z "$CLAUDE_VER" ]; then
  warn "claude CLI not found — install @anthropic-ai/claude-code globally"
else
  ok "Claude Code $CLAUDE_VER"
fi

# ── ~/.claude/settings.json ────────────────────────────────────────────────────

SETTINGS="$HOME/.claude/settings.json"
if [ -f "$SETTINGS" ]; then
  ok "settings.json: $SETTINGS"
else
  fail "settings.json missing at $SETTINGS"
fi

# ── Plugin symlink ─────────────────────────────────────────────────────────────

PLUGIN_LINK="$HOME/.claude/plugins/marketplaces/claude-plugins-official/plugins/curato"
if [ -L "$PLUGIN_LINK" ] && [ -d "$PLUGIN_LINK" ]; then
  ok "Plugin symlink: $PLUGIN_LINK"
elif [ -L "$PLUGIN_LINK" ]; then
  fail "Plugin symlink exists but target is missing: $PLUGIN_LINK"
else
  fail "Plugin not installed — run: bash $CURATO_DIR/scripts/install.sh"
fi

# ── MCP server binary ──────────────────────────────────────────────────────────

MCP_BIN="$CURATO_DIR/mcp-server/dist/index.js"
if [ -f "$MCP_BIN" ]; then
  ok "MCP server binary: $MCP_BIN"
else
  fail "MCP server not built — run: cd $CURATO_DIR/mcp-server && npm run build"
fi

# ── MCP registration ───────────────────────────────────────────────────────────

if [ -f "$SETTINGS" ]; then
  if node -e "
    const s = JSON.parse(require('fs').readFileSync('$SETTINGS','utf8'));
    const mcp = s.mcpServers || {};
    process.exit('curato' in mcp ? 0 : 1);
  " 2>/dev/null; then
    ok "curato registered in settings.json"
  else
    fail "curato not in settings.json mcpServers — run: bash $CURATO_DIR/scripts/install.sh"
  fi
fi

# ── Summary ────────────────────────────────────────────────────────────────────

echo ""
echo "=== Summary: $PASS ok, $WARN warn, $FAIL fail ==="

if [ "$FAIL" -gt 0 ]; then
  echo "Anomalies detected. Run: bash $CURATO_DIR/scripts/install.sh"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo "Curato: minor warnings found. Review above."
  exit 0
else
  echo "Curato is operational."
fi

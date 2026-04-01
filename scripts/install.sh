#!/usr/bin/env bash
set -euo pipefail

CURATO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MCP_CONF="$HOME/.claude/settings.json"

echo "Installing Curato..."
echo ""

# ── 1. Build MCP server ────────────────────────────────────────────────────────

echo "  [1/3] Building MCP server..."
cd "$CURATO_DIR/mcp-server"
npm install --silent
npm run build --silent
echo "  [OK]  MCP server built at $CURATO_DIR/mcp-server/dist/index.js"

# ── 2. Install plugin via local marketplace ───────────────────────────────────

echo ""
echo "  [2/3] Installing plugin..."

if claude plugin marketplace list 2>/dev/null | grep -q "curato-local"; then
  echo "  [skip] Marketplace already registered"
else
  claude plugin marketplace add "$CURATO_DIR/marketplace"
  echo "  [OK]  Marketplace registered"
fi

if claude plugin list 2>/dev/null | grep -q "curato"; then
  echo "  [skip] Plugin already installed"
else
  claude plugin install curato
  echo "  [OK]  Plugin installed"
fi

# Bust plugin cache so updated command files are picked up immediately
CACHE_DIR="$HOME/.claude/plugins/cache/curato-local/curato"
if [ -d "$CACHE_DIR" ]; then
  VERSION=$(ls "$CACHE_DIR" 2>/dev/null | head -1)
  if [ -n "$VERSION" ]; then
    cp -r "$CURATO_DIR/plugin/commands/." "$CACHE_DIR/$VERSION/commands/" 2>/dev/null || true
    cp -r "$CURATO_DIR/plugin/agents/."  "$CACHE_DIR/$VERSION/agents/"  2>/dev/null || true
    cp -r "$CURATO_DIR/plugin/skills/."  "$CACHE_DIR/$VERSION/skills/"  2>/dev/null || true
    echo "  [OK]  Plugin cache refreshed"
  fi
fi

# ── 3. Register MCP server ─────────────────────────────────────────────────────

echo ""
echo "  [3/3] Registering MCP server..."
NODE_BIN="$(which node)"

# Register with claude CLI (writes to ~/.claude.json)
if claude mcp list 2>/dev/null | grep -q "curato"; then
  echo "  [skip] MCP already registered in claude CLI"
else
  claude mcp add -s user curato "$NODE_BIN" "$CURATO_DIR/mcp-server/dist/index.js"
  echo "  [OK]  MCP registered in claude CLI (~/.claude.json)"
fi

# Also register in settings.json for VS Code extension
node "$CURATO_DIR/scripts/register-mcp.js" \
  --name "curato" \
  --command "$NODE_BIN" \
  --args "$CURATO_DIR/mcp-server/dist/index.js" \
  --config "$MCP_CONF"

# ── Done ───────────────────────────────────────────────────────────────────────

echo ""
echo "Curato: Installation complete."
echo "Reload your Claude Code window, then run /doctor to verify."

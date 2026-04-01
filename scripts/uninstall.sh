#!/usr/bin/env bash
# Removes ONLY curato. Never touches other plugins, MCP servers, or user config.
set -euo pipefail

OLD_SYMLINK="$HOME/.claude/plugins/marketplaces/claude-plugins-official/plugins/curato"

echo "Removing Curato..."
echo ""

# ── 1. Uninstall plugin ────────────────────────────────────────────────────────

echo "  [1/4] Uninstalling plugin..."
if claude plugin list 2>/dev/null | grep -q "curato"; then
  claude plugin uninstall curato
  echo "  [OK]  Plugin uninstalled"
else
  echo "  [skip] Plugin not installed"
fi

# ── 2. Remove local marketplace ───────────────────────────────────────────────

echo ""
echo "  [2/4] Removing local marketplace..."
if claude plugin marketplace list 2>/dev/null | grep -q "curato-local"; then
  claude plugin marketplace remove curato-local
  echo "  [OK]  Marketplace removed"
else
  echo "  [skip] Marketplace not registered"
fi

# ── 3. Remove MCP server registration ─────────────────────────────────────────
# Only removes the "curato" entry. All other MCP servers are untouched.

echo ""
echo "  [3/4] Removing MCP server registration..."

# claude CLI (~/.claude.json)
if claude mcp list 2>/dev/null | grep -q "curato"; then
  claude mcp remove curato -s user 2>/dev/null || claude mcp remove curato 2>/dev/null || true
  echo "  [OK]  Removed from claude CLI"
else
  echo "  [skip] Not in claude CLI registry"
fi

# VS Code settings.json (~/.claude/settings.json) — remove only the curato key
SETTINGS="$HOME/.claude/settings.json"
if [ -f "$SETTINGS" ] && python3 -c "import json; d=json.load(open('$SETTINGS')); exit(0 if 'curato' in d.get('mcpServers',{}) else 1)" 2>/dev/null; then
  # Backup first
  BACKUP_DIR="$HOME/.curato-backups/$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  cp "$SETTINGS" "$BACKUP_DIR/settings.json"
  # Remove only the curato key
  python3 -c "
import json
path = '$SETTINGS'
d = json.load(open(path))
servers = d.get('mcpServers', {})
if 'curato' in servers:
    del servers['curato']
    d['mcpServers'] = servers
    with open(path, 'w') as f:
        json.dump(d, f, indent=2)
        f.write('\n')
"
  echo "  [OK]  Removed from ~/.claude/settings.json (backup: $BACKUP_DIR)"
else
  echo "  [skip] Not in ~/.claude/settings.json"
fi

# ── 4. Remove old symlink (legacy install.sh artifact) ────────────────────────

echo ""
echo "  [4/4] Cleaning up old symlink..."
if [ -L "$OLD_SYMLINK" ]; then
  rm "$OLD_SYMLINK"
  echo "  [OK]  Removed $OLD_SYMLINK"
else
  echo "  [skip] No legacy symlink found"
fi

# ── Done ───────────────────────────────────────────────────────────────────────

echo ""
echo "Curato: Curato removed. Your other plugins and MCP servers are untouched."
echo "Run install.sh to reinstall."

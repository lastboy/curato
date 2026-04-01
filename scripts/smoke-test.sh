#!/usr/bin/env bash
# Curato — standalone smoke test script
# Usage: bash smoke-test.sh [fixture-dir]

set -euo pipefail

CURATO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURE="${1:-$CURATO_DIR/smoke-test-fixture}"
SERVER_BIN="$CURATO_DIR/mcp-server/dist/index.js"
PASS=0
FAIL=0

step_pass() { echo "  [PASS] $1"; PASS=$((PASS+1)); }
step_fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

echo "Running smoke test..."
echo ""

# ── 1. node-reachable ─────────────────────────────────────────────────────────

NODE_VER=$(node --version 2>/dev/null || echo "")
if [ -z "$NODE_VER" ]; then
  step_fail "node-reachable       NOT FOUND"
else
  MAJOR=$(echo "$NODE_VER" | sed 's/v\([0-9]*\).*/\1/')
  if [ "$MAJOR" -ge 18 ]; then
    step_pass "node-reachable       $NODE_VER"
  else
    step_fail "node-reachable       $NODE_VER (need >= 18)"
  fi
fi

# ── 2. mcp-server-built ───────────────────────────────────────────────────────

if [ -f "$SERVER_BIN" ]; then
  step_pass "mcp-server-built     $SERVER_BIN"
else
  step_fail "mcp-server-built     NOT BUILT — run: cd mcp-server && npm run build"
fi

# ── 3. plugin-readable ────────────────────────────────────────────────────────

PLUGIN_JSON="$CURATO_DIR/plugin/.claude-plugin/plugin.json"
if node -e "
  const p = JSON.parse(require('fs').readFileSync('$PLUGIN_JSON','utf8'));
  if (p.name !== 'curato') throw new Error('wrong name');
  if (!p.description) throw new Error('missing description');
" 2>/dev/null; then
  step_pass "plugin-readable      plugin.json valid"
else
  step_fail "plugin-readable      plugin.json invalid or missing"
fi

# ── 4. doctor-command-exists ──────────────────────────────────────────────────

DOCTOR_MD="$CURATO_DIR/plugin/commands/doctor.md"
if [ -f "$DOCTOR_MD" ] && grep -q "^description:" "$DOCTOR_MD"; then
  step_pass "doctor-command-exists plugin/commands/doctor.md"
else
  step_fail "doctor-command-exists NOT FOUND or missing description"
fi

# ── 5. mcp-server-roundtrip ───────────────────────────────────────────────────

if [ -f "$SERVER_BIN" ]; then
  INIT_MSG='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"0.1"}}}'
  RESPONSE=$(printf '%s\n' "$INIT_MSG" | node "$SERVER_BIN" 2>/dev/null | head -1 || echo "")
  if echo "$RESPONSE" | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));if(!r.result)throw new Error();" 2>/dev/null; then
    step_pass "mcp-roundtrip        initialize OK"
  else
    step_fail "mcp-roundtrip        no valid response from server"
  fi
else
  step_fail "mcp-roundtrip        (skipped — server not built)"
fi

# ── Summary ────────────────────────────────────────────────────────────────────

echo ""
echo "=== $PASS/$((PASS+FAIL)) checks passed ==="
echo ""

if [ "$FAIL" -eq 0 ]; then
  echo "Curato is operational."
else
  echo "Anomalies detected. Review failures above."
  exit 1
fi

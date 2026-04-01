#!/usr/bin/env bash
# init-team.sh — Apply curato-setup.json without Node.js / MCP server.
# Uses python3 to parse JSON and the claude CLI to install plugins/MCP servers.
set -euo pipefail

CONFIG_FILE="${1:-curato-setup.json}"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: $CONFIG_FILE not found."
  echo "Copy curato-setup.example.json to curato-setup.json and configure it."
  exit 1
fi

# Verify python3 is available
if ! command -v python3 &>/dev/null; then
  echo "Error: python3 is required to parse curato-setup.json."
  exit 1
fi

# Verify claude CLI is available
if ! command -v claude &>/dev/null; then
  echo "Error: claude CLI not found. Install Claude Code first."
  exit 1
fi

echo "Applying team setup from $CONFIG_FILE..."
echo ""

# ── Validate version ──────────────────────────────────────────────────────────

VERSION=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('version',''))" 2>/dev/null || echo "")
if [ "$VERSION" != "1" ]; then
  echo "Error: curato-setup.json must have \"version\": 1"
  exit 1
fi

# ── Warn about extends (not supported in bash version) ────────────────────────

EXTENDS=$(python3 -c "import json; d=json.load(open('$CONFIG_FILE')); print(d.get('extends',''))" 2>/dev/null || echo "")
if [ -n "$EXTENDS" ]; then
  echo "Warning: \"extends\" ($EXTENDS) is not supported in the bash fallback."
  echo "  For full support including remote config inheritance, use the MCP version: /setup-team"
  echo ""
fi

# ── MCP servers ───────────────────────────────────────────────────────────────

MCP_COUNT=$(python3 -c "
import json
d = json.load(open('$CONFIG_FILE'))
servers = d.get('mcpServers', {})
print(len(servers))
" 2>/dev/null || echo "0")

if [ "$MCP_COUNT" -gt 0 ]; then
  echo "  Registering $MCP_COUNT MCP server(s)..."
  python3 -c "
import json, subprocess, sys
d = json.load(open('$CONFIG_FILE'))
for name, entry in d.get('mcpServers', {}).items():
    command = entry.get('command', '')
    args = entry.get('args', [])
    scope = entry.get('scope', 'user')

    # Check if already registered
    result = subprocess.run(['claude', 'mcp', 'list'], capture_output=True, text=True)
    if name in result.stdout:
        print(f'  [skip] {name} already registered')
        continue

    # Register
    cli_scope = '-s' + scope if scope == 'user' else '-s' + 'local'
    cmd = ['claude', 'mcp', 'add', cli_scope, name, command] + args
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        print(f'  [OK]   {name} registered ({scope} scope)')
    else:
        print(f'  [FAIL] {name}: {r.stderr.strip()}', file=sys.stderr)
"
fi

# ── Plugins ───────────────────────────────────────────────────────────────────

PLUGIN_COUNT=$(python3 -c "
import json
d = json.load(open('$CONFIG_FILE'))
print(len(d.get('plugins', [])))
" 2>/dev/null || echo "0")

if [ "$PLUGIN_COUNT" -gt 0 ]; then
  echo ""
  echo "  Installing $PLUGIN_COUNT plugin(s)..."

  # Get list of already-installed plugins
  INSTALLED=$(claude plugin list --json 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
installed=[p.get('name','') for p in d.get('installed',[])]
print('\n'.join(installed))
" 2>/dev/null || echo "")

  python3 -c "
import json, subprocess, sys
installed_raw = '''$INSTALLED'''
installed = set(installed_raw.strip().split('\n')) if installed_raw.strip() else set()

d = json.load(open('$CONFIG_FILE'))
for plugin in d.get('plugins', []):
    if plugin in installed:
        print(f'  [skip] {plugin} already installed')
        continue
    r = subprocess.run(['claude', 'plugin', 'install', plugin], capture_output=True, text=True)
    if r.returncode == 0:
        print(f'  [OK]   {plugin} installed')
    else:
        print(f'  [FAIL] {plugin}: {r.stderr.strip()}', file=sys.stderr)
"
fi

# ── CLAUDE.md ─────────────────────────────────────────────────────────────────

python3 -c "
import json, os, sys

d = json.load(open('$CONFIG_FILE'))
claude_md = d.get('claudeMd', {})

# Project scope
project = claude_md.get('project')
if project:
    path = 'CLAUDE.md'
    mode = project.get('mode', 'create-if-missing')
    content = project.get('content', '')
    if mode == 'create-if-missing' and os.path.exists(path):
        print(f'  [skip] {path} already exists')
    else:
        if not os.path.exists(path):
            with open(path, 'w') as f:
                f.write(content)
            print(f'  [OK]   {path} created')
        elif mode == 'append-if-missing-section':
            section = project.get('section', content.split('\n')[0])
            existing = open(path).read()
            if section in existing:
                print(f'  [skip] {path} already has section')
            else:
                with open(path, 'a') as f:
                    f.write('\n\n' + content)
                print(f'  [OK]   {path} updated')

# User scope
user = claude_md.get('user')
if user:
    home = os.path.expanduser('~')
    path = os.path.join(home, '.claude', 'CLAUDE.md')
    mode = user.get('mode', 'append-if-missing-section')
    content = user.get('content', '')
    section = user.get('section', content.split('\n')[0])

    os.makedirs(os.path.dirname(path), exist_ok=True)
    existing = open(path).read() if os.path.exists(path) else ''

    if section and section in existing:
        print(f'  [skip] ~/.claude/CLAUDE.md already has section')
    else:
        with open(path, 'a') as f:
            if existing:
                f.write('\n\n')
            f.write(content)
        print(f'  [OK]   ~/.claude/CLAUDE.md updated')
"

echo ""
echo "Curato: Team setup complete."
echo "Reload your Claude Code window to pick up any new MCP servers."

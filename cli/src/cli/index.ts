#!/usr/bin/env node
import { install } from './commands/install.js';
import { uninstall } from './commands/uninstall.js';
import { setup } from './commands/setup.js';
import { teardown } from './commands/teardown.js';
import { registerMcp } from './commands/register-mcp.js';
import { removeMcp } from './commands/remove-mcp.js';
import { scan } from './commands/scan.js';
import { clearCache } from './commands/clear-cache.js';
import { launchChrome } from './commands/launch-chrome.js';
import { installAgentGuide } from './commands/install-agent-guide.js';
import { installShellEnvCmd } from './commands/install-shell-env.js';
import { uninstallShellEnvCmd } from './commands/uninstall-shell-env.js';
import { boldStr, dim, line } from './print.js';

const [, , command, ...args] = process.argv;

const HELP = `
${boldStr('curato')} — Claude Code environment setup and plugin management

USAGE
  curato <command> [options]

COMMANDS
  install <plugin>     Install a plugin with optional skill filters
  uninstall <plugin>   Uninstall a plugin
  setup                Apply curato-setup.json config
  teardown             Reverse everything curato setup applied (from the same config)
  register-mcp         Register an MCP server in Claude Code
  remove-mcp           Remove an MCP server from Claude Code
  scan                 Snapshot of the current Claude Code environment
  clear-cache          Delete plugin cache directories
  launch-chrome [url]  Launch Chrome with remote debugging for chrome-devtools MCP
  install-agent-guide  Append the Curato agent-role guide into CLAUDE.md
  install-shell-env    Forward shell env vars to GUI-launched apps (macOS)
  uninstall-shell-env  Remove the shell-env LaunchAgent

OPTIONS
  --help, -h           Show help for a command
  --dry-run            Preview changes without applying them

EXAMPLES
  curato install superpowers --exclude writing-skills,subagent-driven-development
  curato uninstall superpowers
  curato setup
  curato setup --config ./team/curato-setup.json
  curato register-mcp my-server npx my-server-package --scope user
  curato remove-mcp my-server

DOCS
  Config format: https://github.com/your-org/curato#curato-setupjson
`;

async function main() {
  if (!command || command === '--help' || command === '-h') {
    console.log(HELP);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'install':      await install(args); break;
      case 'uninstall':    await uninstall(args); break;
      case 'setup':        await setup(args); break;
      case 'teardown':     await teardown(args); break;
      case 'register-mcp': await registerMcp(args); break;
      case 'remove-mcp':   await removeMcp(args); break;
      case 'scan':         await scan(args); break;
      case 'clear-cache':  await clearCache(args); break;
      case 'launch-chrome': await launchChrome(args); break;
      case 'install-agent-guide': await installAgentGuide(args); break;
      case 'install-shell-env': await installShellEnvCmd(args); break;
      case 'uninstall-shell-env': await uninstallShellEnvCmd(args); break;
      default:
        console.error(`Unknown command: ${command}`);
        dim('Run curato --help for usage.');
        line();
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();

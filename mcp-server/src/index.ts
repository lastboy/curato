import { CuratoMCPServer } from './server.js';

// Tool registrations — import each tool module so they self-register
// (populated incrementally as phases are implemented)
import './tools/scan.js';
import './tools/inspect.js';
import './tools/plugin.js';
import './tools/mcp.js';
import './tools/recommend.js';
import './tools/apply.js';
import './tools/smoketest.js';
import './tools/team.js';
import './tools/chrome.js';
import './tools/uninstall.js';

const server = new CuratoMCPServer();
server.run().catch((err) => {
  process.stderr.write(`[curato] Fatal: ${String(err)}\n`);
  process.exit(1);
});

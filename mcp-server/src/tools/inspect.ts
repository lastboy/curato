import { register } from './index.js';
import { toolResult } from '../types.js';
import type { InspectProjectSetupParams } from '../types.js';
import { scanUserSetup } from '../scanner/claude-config.js';
import { scanProjectLayout } from '../scanner/project-layout.js';

register(
  {
    name: 'inspect_user_setup',
    description:
      'Inspect global ~/.claude/ setup: settings.json, CLAUDE.md, installed plugins. Returns UserSetupInfo.',
    inputSchema: { type: 'object', properties: {} },
  },
  async (_args) => {
    return toolResult(scanUserSetup());
  },
);

register(
  {
    name: 'inspect_project_setup',
    description:
      'Inspect project-level Claude setup: .claude/, CLAUDE.md, .mcp.json, agents, commands, skills. Returns ProjectLayoutInfo.',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: {
          type: 'string',
          description: 'Project directory to inspect (defaults to process.cwd())',
        },
      },
    },
  },
  async (args) => {
    const { cwd = process.cwd() } = (args as InspectProjectSetupParams) ?? {};
    return toolResult(scanProjectLayout(cwd));
  },
);

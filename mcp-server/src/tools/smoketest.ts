import { register } from './index.js';
import { toolResult } from '../types.js';
import type { CreateSmokeTestAppParams, RunSmokeTestParams } from '../types.js';
import { scaffoldFixture } from '../smoketest/scaffold.js';
import { runSmokeTest } from '../smoketest/runner.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function defaultFixtureDir(): string {
  // mcp-server/src/tools/ → curato-root/smoke-test-fixture/
  return join(__dirname, '..', '..', '..', 'smoke-test-fixture');
}

register(
  {
    name: 'create_smoke_test_app',
    description: 'Scaffold a minimal intentionally-incomplete test fixture project for smoke testing.',
    inputSchema: {
      type: 'object',
      required: ['targetDir'],
      properties: {
        targetDir: { type: 'string', description: 'Directory to scaffold the fixture in' },
      },
    },
  },
  async (args) => {
    const { targetDir } = (args as CreateSmokeTestAppParams) ?? {};
    if (!targetDir) {
      return toolResult({ error: 'targetDir is required' });
    }
    const created = scaffoldFixture(targetDir);
    return toolResult({ targetDir, created, filesCreated: created.length });
  },
);

register(
  {
    name: 'run_smoke_test',
    description:
      'Run the 7-step validation suite. Checks node, server start, tool list, scan, plugin, doctor command, and repair dry-run. Returns SmokeTestReport.',
    inputSchema: {
      type: 'object',
      properties: {
        fixtureDir: {
          type: 'string',
          description: 'Path to fixture directory (defaults to smoke-test-fixture/ in curato dir)',
        },
      },
    },
  },
  async (args) => {
    const { fixtureDir = defaultFixtureDir() } = (args as RunSmokeTestParams) ?? {};
    const report = await runSmokeTest(fixtureDir);
    return toolResult(report);
  },
);

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, ChildProcess } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_BIN = join(__dirname, '..', '..', '..', 'dist', 'index.js');

function sendAndReceive(
  child: ChildProcess,
  messages: string[],
  expectedIds: number[],
  timeoutMs = 10000,
): Promise<Map<number, unknown>> {
  return new Promise((resolve, reject) => {
    const results = new Map<number, unknown>();
    let buffer = '';
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for responses: ${[...expectedIds].filter((id) => !results.has(id)).join(', ')}`));
    }, timeoutMs);

    child.stdout!.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          const id = parsed['id'] as number;
          if (expectedIds.includes(id)) {
            results.set(id, parsed);
          }
          if (expectedIds.every((id) => results.has(id))) {
            clearTimeout(timer);
            resolve(results);
          }
        } catch {
          // ignore non-JSON lines
        }
      }
    });

    for (const msg of messages) {
      child.stdin!.write(msg + '\n');
    }
  });
}

describe('MCP server round-trip integration', () => {
  let child: ChildProcess;

  before(() => {
    child = spawn('node', [SERVER_BIN], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stderr?.on('data', () => {}); // suppress stderr
  });

  after(() => {
    child.kill('SIGTERM');
  });

  test('responds to initialize within 3s', async () => {
    const initMsg = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'integration-test', version: '0.1' },
      },
    });

    const results = await sendAndReceive(child, [initMsg], [1], 3000);
    const resp = results.get(1) as Record<string, unknown>;
    assert.ok(resp, 'should get response for id=1');
    const result = resp['result'] as Record<string, unknown>;
    assert.ok(result, 'response should have result');
    assert.equal((result['serverInfo'] as Record<string, unknown>)?.['name'], 'curato');
  });

  test('tools/list returns all 21 tools', async () => {
    const listMsg = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const results = await sendAndReceive(child, [listMsg], [2], 3000);
    const resp = results.get(2) as Record<string, unknown>;
    const toolList = (resp['result'] as Record<string, unknown>)?.['tools'] as Array<{ name: string }>;
    assert.ok(toolList, 'tools list should be present');
    assert.equal(toolList.length, 21, 'should have exactly 21 tools');

    const expectedTools = [
      'scan_environment', 'check_node_runtime', 'inspect_user_setup',
      'inspect_project_setup', 'check_plugin_state', 'check_mcp_registration',
      'recommend_setup', 'apply_setup', 'repair_setup',
      'create_smoke_test_app', 'run_smoke_test', 'apply_team_setup',
      'check_chrome_devtools', 'setup_chrome_devtools', 'launch_chrome_debug',
      'launch_azure_auth', 'remove_mcp_server', 'register_mcp_both',
      'remove_plugin', 'clear_plugin_cache', 'uninstall_curato',
    ];
    for (const name of expectedTools) {
      assert.ok(toolList.some((t) => t.name === name), `tool "${name}" should be in list`);
    }
  });

  test('scan_environment returns parseable ScanReport', async () => {
    const scanMsg = JSON.stringify({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'scan_environment', arguments: { scope: 'project' } },
    });
    const results = await sendAndReceive(child, [scanMsg], [3], 5000);
    const resp = results.get(3) as Record<string, unknown>;
    const content = (resp['result'] as Record<string, unknown>)?.['content'] as Array<{ text: string }>;
    assert.ok(content?.[0]?.text, 'should have content text');
    const report = JSON.parse(content[0].text) as Record<string, unknown>;
    assert.ok(Array.isArray(report['checks']), 'checks should be array');
    assert.equal(report['persona'], 'Curato');
  });

  test('repair_setup dryRun:true returns parseable RepairReport', async () => {
    const repairMsg = JSON.stringify({
      jsonrpc: '2.0', id: 7, method: 'tools/call',
      params: { name: 'repair_setup', arguments: { checkIds: [], dryRun: true } },
    });
    const results = await sendAndReceive(child, [repairMsg], [7], 5000);
    const resp = results.get(7) as Record<string, unknown>;
    const content = (resp['result'] as Record<string, unknown>)?.['content'] as Array<{ text: string }>;
    assert.ok(content?.[0]?.text, 'should have content text');
    const report = JSON.parse(content[0].text) as Record<string, unknown>;
    assert.ok(typeof report['dryRun'] === 'boolean');
    assert.ok(Array.isArray(report['proposals']));
    assert.ok(Array.isArray(report['applied']));
  });
}, { timeout: 15000 });

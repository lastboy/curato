import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SmokeTestResult, SmokeTestReport } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function curatoRoot(): string {
  // dist/smoketest/ → dist/ → mcp-server/ → curato root
  return join(__dirname, '..', '..', '..');
}

function mcpServerBin(): string {
  return join(curatoRoot(), 'mcp-server', 'dist', 'index.js');
}

function pluginDir(): string {
  return join(curatoRoot(), 'plugin');
}

async function sendMcpMessage(
  serverBin: string,
  messages: string[],
  timeoutMs = 5000,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [serverBin], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const responses: string[] = [];
    let buffer = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      try { child.kill(); } catch { /* already exited */ }
      reject(new Error(`MCP server timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) responses.push(trimmed);
      }
    });

    child.on('close', () => {
      if (!timedOut) {
        clearTimeout(timer);
        resolve(responses);
      }
    });

    for (const msg of messages) {
      child.stdin.write(msg + '\n');
    }
    child.stdin.end();
  });
}

function parseJsonLines(lines: string[]): unknown[] {
  return lines.flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

export async function runSmokeTest(fixtureDir: string): Promise<SmokeTestReport> {
  const steps: SmokeTestResult[] = [];
  const serverBin = mcpServerBin();

  // ── Step 1: node-reachable ────────────────────────────────────────────────

  try {
    const { execSync } = await import('node:child_process');
    const ver = execSync('node --version', { encoding: 'utf8' }).trim();
    const major = parseInt(ver.replace(/^v/, '').split('.')[0] ?? '0', 10);
    steps.push({
      step: 'node-reachable',
      passed: major >= 18,
      output: ver,
      error: major < 18 ? 'Node < 18 not supported' : undefined,
    });
  } catch (e) {
    steps.push({ step: 'node-reachable', passed: false, error: String(e) });
  }

  // ── Step 2: mcp-server-starts ─────────────────────────────────────────────

  if (!existsSync(serverBin)) {
    steps.push({
      step: 'mcp-server-starts',
      passed: false,
      error: `Binary not found: ${serverBin}`,
    });
  } else {
    const initMsg = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke-test', version: '0.1' } },
    });
    const t0 = Date.now();
    try {
      const lines = await sendMcpMessage(serverBin, [initMsg]);
      const parsed = parseJsonLines(lines);
      const ok = parsed.some(
        (r) =>
          typeof r === 'object' &&
          r !== null &&
          'result' in r &&
          (r as Record<string, unknown>)['id'] === 1,
      );
      steps.push({
        step: 'mcp-server-starts',
        passed: ok,
        output: `${Date.now() - t0}ms`,
        error: ok ? undefined : 'No valid initialize response',
      });
    } catch (e) {
      steps.push({ step: 'mcp-server-starts', passed: false, error: String(e) });
    }
  }

  // ── Step 3: tool-list ─────────────────────────────────────────────────────

  if (existsSync(serverBin)) {
    const initMsg = JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke-test', version: '0.1' } },
    });
    const listMsg = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    try {
      const lines = await sendMcpMessage(serverBin, [initMsg, listMsg]);
      const parsed = parseJsonLines(lines);
      const listResp = parsed.find(
        (r) => typeof r === 'object' && r !== null && (r as Record<string, unknown>)['id'] === 2,
      ) as Record<string, unknown> | undefined;
      const tools = listResp?.['result'] as Record<string, unknown> | undefined;
      const toolList = (tools?.['tools'] as Array<{ name: string }>) ?? [];
      const hasScan = toolList.some((t) => t.name === 'scan_environment');
      steps.push({
        step: 'tool-list',
        passed: hasScan,
        output: `${toolList.length} tools registered`,
        error: hasScan ? undefined : 'scan_environment not found in tool list',
      });
    } catch (e) {
      steps.push({ step: 'tool-list', passed: false, error: String(e) });
    }
  } else {
    steps.push({ step: 'tool-list', passed: false, error: 'Server binary missing' });
  }

  // ── Step 4: scan-runs ─────────────────────────────────────────────────────

  if (existsSync(serverBin)) {
    const initMsg = JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke-test', version: '0.1' } },
    });
    const scanMsg = JSON.stringify({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'scan_environment', arguments: { scope: 'project', cwd: fixtureDir } },
    });
    try {
      const lines = await sendMcpMessage(serverBin, [initMsg, scanMsg]);
      const parsed = parseJsonLines(lines);
      const scanResp = parsed.find(
        (r) => typeof r === 'object' && r !== null && (r as Record<string, unknown>)['id'] === 3,
      ) as Record<string, unknown> | undefined;
      const content = (scanResp?.['result'] as Record<string, unknown>)?.['content'] as Array<{ text: string }>;
      let ok = false;
      if (content?.[0]?.text) {
        const report = JSON.parse(content[0].text) as Record<string, unknown>;
        ok = Array.isArray(report['checks']);
      }
      steps.push({
        step: 'scan-runs',
        passed: ok,
        output: ok ? 'ScanReport parseable' : undefined,
        error: ok ? undefined : 'Could not parse ScanReport',
      });
    } catch (e) {
      steps.push({ step: 'scan-runs', passed: false, error: String(e) });
    }
  } else {
    steps.push({ step: 'scan-runs', passed: false, error: 'Server binary missing' });
  }

  // ── Step 5: plugin-readable ───────────────────────────────────────────────

  const pluginJsonPath = join(pluginDir(), '.claude-plugin', 'plugin.json');
  try {
    const pj = JSON.parse(readFileSync(pluginJsonPath, 'utf8')) as Record<string, unknown>;
    const ok =
      typeof pj['name'] === 'string' &&
      pj['name'] === 'curato' &&
      typeof pj['description'] === 'string';
    steps.push({
      step: 'plugin-readable',
      passed: ok,
      output: ok ? `plugin.json valid (${pj['name']} v${pj['version'] ?? 'n/a'})` : undefined,
      error: ok ? undefined : 'plugin.json missing required fields',
    });
  } catch (e) {
    steps.push({ step: 'plugin-readable', passed: false, error: String(e) });
  }

  // ── Step 6: doctor-command-exists ─────────────────────────────────────────

  const doctorMdPath = join(pluginDir(), 'commands', 'doctor.md');
  const doctorExists = existsSync(doctorMdPath);
  let doctorHasFrontmatter = false;
  if (doctorExists) {
    const content = readFileSync(doctorMdPath, 'utf8');
    doctorHasFrontmatter = content.startsWith('---') && content.includes('description:');
  }
  steps.push({
    step: 'doctor-command-exists',
    passed: doctorExists && doctorHasFrontmatter,
    output: doctorExists ? doctorMdPath : undefined,
    error:
      !doctorExists
        ? `doctor.md not found at ${doctorMdPath}`
        : !doctorHasFrontmatter
          ? 'doctor.md missing description frontmatter'
          : undefined,
  });

  // ── Step 7: repair-dry-run ────────────────────────────────────────────────

  if (existsSync(serverBin)) {
    const initMsg = JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke-test', version: '0.1' } },
    });
    const repairMsg = JSON.stringify({
      jsonrpc: '2.0', id: 7, method: 'tools/call',
      params: { name: 'repair_setup', arguments: { checkIds: [], dryRun: true, cwd: fixtureDir } },
    });
    try {
      const lines = await sendMcpMessage(serverBin, [initMsg, repairMsg]);
      const parsed = parseJsonLines(lines);
      const repairResp = parsed.find(
        (r) => typeof r === 'object' && r !== null && (r as Record<string, unknown>)['id'] === 7,
      ) as Record<string, unknown> | undefined;
      const content = (repairResp?.['result'] as Record<string, unknown>)?.['content'] as Array<{ text: string }>;
      let ok = false;
      if (content?.[0]?.text) {
        const report = JSON.parse(content[0].text) as Record<string, unknown>;
        ok = typeof report['dryRun'] === 'boolean' && Array.isArray(report['proposals']);
      }
      steps.push({
        step: 'repair-dry-run',
        passed: ok,
        output: ok ? 'RepairReport parseable' : undefined,
        error: ok ? undefined : 'Could not parse RepairReport',
      });
    } catch (e) {
      steps.push({ step: 'repair-dry-run', passed: false, error: String(e) });
    }
  } else {
    steps.push({ step: 'repair-dry-run', passed: false, error: 'Server binary missing' });
  }

  const passed = steps.every((s) => s.passed);
  return { passed, steps, fixturePath: fixtureDir };
}

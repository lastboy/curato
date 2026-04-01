import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { get } from 'node:https';
import type { TeamSetupConfig } from '../types.js';
import { safeMerge } from '../patcher/json-merger.js';

function parseConfig(raw: unknown): TeamSetupConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj['version'] !== 1) return null;
  return obj as unknown as TeamSetupConfig;
}

function readLocalConfig(filePath: string): TeamSetupConfig | null {
  if (!existsSync(filePath)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    return parseConfig(parsed);
  } catch {
    return null;
  }
}

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers['location'];
        if (location) { fetchUrl(location).then(resolve, reject); return; }
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => resolve(body));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchGithubConfig(extendsRef: string): Promise<TeamSetupConfig | null> {
  // "github:org/repo" or "github:org/repo/path/to/curato-setup.json"
  const withoutPrefix = extendsRef.slice('github:'.length);
  const parts = withoutPrefix.split('/');
  if (parts.length < 2) return null;
  const org = parts[0];
  const repo = parts[1];
  const filePath = parts.length > 2 ? parts.slice(2).join('/') : 'curato-setup.json';
  const url = `https://raw.githubusercontent.com/${org}/${repo}/main/${filePath}`;
  try {
    const body = await fetchUrl(url);
    const parsed: unknown = JSON.parse(body);
    return parseConfig(parsed);
  } catch {
    return null;
  }
}

export async function readTeamConfig(cwd: string): Promise<TeamSetupConfig | null> {
  const localPath = join(cwd, 'curato-setup.json');
  const local = readLocalConfig(localPath);

  if (!local) return null;

  // If no extends, return local as-is
  if (!local.extends) return local;

  // Fetch remote base config
  let remote: TeamSetupConfig | null = null;
  if (local.extends.startsWith('github:')) {
    remote = await fetchGithubConfig(local.extends);
  }

  if (!remote) return local;

  // Merge: remote is base, local overrides (local wins via safeMerge target-wins semantics)
  const merged = safeMerge(
    local as unknown as Record<string, unknown>,
    remote as unknown as Record<string, unknown>,
  );
  return merged as unknown as TeamSetupConfig;
}

export function validateTeamConfig(raw: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Config must be a JSON object'] };
  }
  const obj = raw as Record<string, unknown>;

  if (obj['version'] !== 1) {
    errors.push('version must be 1');
  }

  const knownKeys = new Set(['version', 'extends', 'mcpServers', 'plugins', 'claudeMd']);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) errors.push(`Unknown key: "${key}"`);
  }

  if (obj['extends'] !== undefined && typeof obj['extends'] !== 'string') {
    errors.push('"extends" must be a string (e.g. "github:org/repo")');
  }

  if (obj['mcpServers'] !== undefined) {
    if (typeof obj['mcpServers'] !== 'object' || Array.isArray(obj['mcpServers'])) {
      errors.push('"mcpServers" must be an object');
    } else {
      for (const [name, entry] of Object.entries(obj['mcpServers'] as Record<string, unknown>)) {
        if (!entry || typeof entry !== 'object') {
          errors.push(`mcpServers.${name}: must be an object`);
          continue;
        }
        const e = entry as Record<string, unknown>;
        if (typeof e['command'] !== 'string') errors.push(`mcpServers.${name}: "command" must be a string`);
        if (e['scope'] !== 'user' && e['scope'] !== 'project') {
          errors.push(`mcpServers.${name}: "scope" must be "user" or "project"`);
        }
      }
    }
  }

  if (obj['plugins'] !== undefined) {
    if (!Array.isArray(obj['plugins'])) {
      errors.push('"plugins" must be an array');
    } else {
      (obj['plugins'] as unknown[]).forEach((p, i) => {
        if (typeof p === 'string') return; // simple string form — valid
        if (!p || typeof p !== 'object' || Array.isArray(p)) {
          errors.push(`plugins[${i}]: must be a string or { name, skills? } object`);
          return;
        }
        const pe = p as Record<string, unknown>;
        if (typeof pe['name'] !== 'string' || !pe['name']) {
          errors.push(`plugins[${i}].name: must be a non-empty string`);
        }
        if (pe['skills'] !== undefined) {
          if (!pe['skills'] || typeof pe['skills'] !== 'object' || Array.isArray(pe['skills'])) {
            errors.push(`plugins[${i}].skills: must be an object with include and exclude arrays`);
          } else {
            const s = pe['skills'] as Record<string, unknown>;
            for (const key of ['include', 'exclude'] as const) {
              if (!Array.isArray(s[key])) {
                errors.push(`plugins[${i}].skills.${key}: must be an array of skill name strings`);
              } else {
                (s[key] as unknown[]).forEach((v, j) => {
                  if (typeof v !== 'string') errors.push(`plugins[${i}].skills.${key}[${j}]: must be a string`);
                });
              }
            }
          }
        }
      });
    }
  }

  if (obj['claudeMd'] !== undefined) {
    if (typeof obj['claudeMd'] !== 'object' || Array.isArray(obj['claudeMd'])) {
      errors.push('"claudeMd" must be an object');
    } else {
      const md = obj['claudeMd'] as Record<string, unknown>;
      for (const scope of ['project', 'user'] as const) {
        if (md[scope] !== undefined) {
          const entry = md[scope] as Record<string, unknown>;
          const validModes = ['create-if-missing', 'append-if-missing-section'];
          if (!validModes.includes(entry['mode'] as string)) {
            errors.push(`claudeMd.${scope}.mode must be one of: ${validModes.join(', ')}`);
          }
          if (typeof entry['content'] !== 'string') {
            errors.push(`claudeMd.${scope}.content must be a string`);
          }
          if (entry['mode'] === 'append-if-missing-section' && typeof entry['section'] !== 'string') {
            errors.push(`claudeMd.${scope}.section is required when mode is "append-if-missing-section"`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

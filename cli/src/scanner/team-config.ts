import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { get } from 'node:https';
import type { TeamSetupConfig } from '../types.js';
import { safeMerge } from '../patcher/json-merger.js';
import { isAllowedRemoteHost } from '../utils/validate.js';

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
    if (!isAllowedRemoteHost(url)) {
      reject(new Error(`Refusing to fetch ${url} — host not in allowlist`));
      return;
    }
    get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers['location'];
        if (location) {
          if (!isAllowedRemoteHost(location)) {
            reject(new Error(`Refusing redirect to ${location} — host not in allowlist`));
            return;
          }
          fetchUrl(location).then(resolve, reject);
          return;
        }
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

  const knownKeys = new Set(['version', 'extends', 'shellEnv', 'marketplaces', 'mcpServers', 'plugins', 'claudeMd']);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) errors.push(`Unknown key: "${key}"`);
  }

  if (obj['extends'] !== undefined && typeof obj['extends'] !== 'string') {
    errors.push('"extends" must be a string (e.g. "github:org/repo")');
  }

  if (obj['shellEnv'] !== undefined) {
    if (typeof obj['shellEnv'] !== 'object' || obj['shellEnv'] === null || Array.isArray(obj['shellEnv'])) {
      errors.push('"shellEnv" must be an object');
    } else {
      const se = obj['shellEnv'] as Record<string, unknown>;
      if (!Array.isArray(se['vars'])) {
        errors.push('shellEnv.vars: must be an array of env var names');
      } else {
        (se['vars'] as unknown[]).forEach((v, i) => {
          if (typeof v !== 'string' || !/^[A-Z_][A-Z0-9_]*$/i.test(v)) {
            errors.push(`shellEnv.vars[${i}]: must be a valid env var name (letters, digits, underscore)`);
          }
        });
      }
      if (se['sourceFile'] !== undefined && typeof se['sourceFile'] !== 'string') {
        errors.push('shellEnv.sourceFile: must be a string path');
      }
    }
  }

  if (obj['marketplaces'] !== undefined) {
    if (typeof obj['marketplaces'] !== 'object' || Array.isArray(obj['marketplaces'])) {
      errors.push('"marketplaces" must be an object');
    } else {
      for (const [name, entry] of Object.entries(obj['marketplaces'] as Record<string, unknown>)) {
        if (!entry || typeof entry !== 'object') {
          errors.push(`marketplaces.${name}: must be an object`);
          continue;
        }
        const e = entry as Record<string, unknown>;
        if (typeof e['source'] !== 'string' || !e['source']) {
          errors.push(`marketplaces.${name}: "source" must be a non-empty string`);
        }
        if (e['scope'] !== undefined && !['user', 'project', 'local'].includes(e['scope'] as string)) {
          errors.push(`marketplaces.${name}: "scope" must be "user", "project", or "local"`);
        }
        if (e['sparse'] !== undefined && !Array.isArray(e['sparse'])) {
          errors.push(`marketplaces.${name}: "sparse" must be an array of strings`);
        }
      }
    }
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
            errors.push(`plugins[${i}].skills: must be an object with an "include" or "exclude" array`);
          } else {
            const s = pe['skills'] as Record<string, unknown>;
            const hasInclude = s['include'] !== undefined;
            const hasExclude = s['exclude'] !== undefined;
            if (!hasInclude && !hasExclude) {
              errors.push(`plugins[${i}].skills: must define "include" or "exclude"`);
            }
            if (hasInclude && hasExclude) {
              errors.push(`plugins[${i}].skills: "include" and "exclude" are mutually exclusive`);
            }
            for (const key of ['include', 'exclude'] as const) {
              if (s[key] === undefined) continue;
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
          const validModes = ['create-if-missing', 'overwrite', 'append-if-missing-section'];
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

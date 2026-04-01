import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { NodeRuntimeInfo } from '../types.js';
import { whichCmd, pathSep } from '../utils/platform.js';

function execSafe(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

export function parseMinVersion(versionStr: string): boolean {
  const match = versionStr.match(/^v?(\d+)/);
  if (!match) return false;
  return parseInt(match[1], 10) >= 18;
}

export function scanNodeRuntime(): NodeRuntimeInfo {
  const nodeVersion = execSafe('node --version');
  const npmVersion = execSafe('npm --version');
  const nodePath = execSafe(`${whichCmd()} node`);

  // Support both unix nvm (NVM_DIR) and nvm-windows (NVM_HOME)
  const nvmDir = process.env['NVM_DIR'] ?? '';
  const nvmHome = process.env['NVM_HOME'] ?? '';
  const nvmActive = (nvmDir !== '' && existsSync(nvmDir)) || (nvmHome !== '' && existsSync(nvmHome));

  let nvmCurrentVersion: string | undefined;
  if (nvmActive) {
    if (nvmDir && existsSync(nvmDir)) {
      // unix nvm: current version stored in alias/default file
      const defaultAlias = `${nvmDir}/alias/default`;
      if (existsSync(defaultAlias)) {
        try {
          nvmCurrentVersion = readFileSync(defaultAlias, 'utf8').trim();
        } catch {
          // ignore
        }
      }
    } else if (nvmHome && existsSync(nvmHome)) {
      // nvm-windows: current version is a subdirectory named like "v20.11.0"
      try {
        const entries = readdirSync(nvmHome, { withFileTypes: true });
        const versions = entries
          .filter((e) => e.isDirectory() && /^v?\d+\.\d+\.\d+$/.test(e.name))
          .map((e) => e.name)
          .sort()
          .reverse();
        // Best effort — return undefined rather than guess if list is ambiguous
        if (versions.length === 1) nvmCurrentVersion = versions[0];
      } catch {
        // ignore — return undefined
      }
    }
    if (!nvmCurrentVersion) {
      nvmCurrentVersion = nodeVersion || undefined;
    }
  }

  const pathEnv = process.env['PATH'] ?? '';
  const pathContainsNvm = pathEnv
    .split(pathSep())
    .some((seg) => seg.includes('/nvm/') || seg.endsWith('/nvm') || seg.includes('\\nvm\\'));

  return {
    nodeVersion: nodeVersion || 'unknown',
    nodeMinMet: parseMinVersion(nodeVersion),
    nodePath: nodePath || 'unknown',
    npmVersion: npmVersion || 'unknown',
    nvmActive,
    nvmCurrentVersion,
    pathContainsNvm,
  };
}

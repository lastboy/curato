import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';

function timestamp(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return (
    `${now.getFullYear()}` +
    `${pad(now.getMonth() + 1)}` +
    `${pad(now.getDate())}` +
    `-` +
    `${pad(now.getHours())}` +
    `${pad(now.getMinutes())}` +
    `${pad(now.getSeconds())}`
  );
}

/**
 * Create a timestamped backup of a file before mutation.
 * Backups are written to ~/.curato-backups/YYYYMMDD-HHmmss/<filename>
 * Returns the backup directory path.
 */
export function backupFile(filePath: string): string {
  const backupBase = join(homedir(), '.curato-backups', timestamp());
  mkdirSync(backupBase, { recursive: true });

  if (existsSync(filePath)) {
    copyFileSync(filePath, join(backupBase, basename(filePath)));
  }

  return backupBase;
}

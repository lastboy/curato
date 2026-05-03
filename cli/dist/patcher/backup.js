import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
function timestamp() {
    const now = new Date();
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return (`${now.getFullYear()}` +
        `${pad(now.getMonth() + 1)}` +
        `${pad(now.getDate())}` +
        `-` +
        `${pad(now.getHours())}` +
        `${pad(now.getMinutes())}` +
        `${pad(now.getSeconds())}`);
}
/**
 * Root directory for backup archives. Defaults to ~/.curato-backups.
 * Override via CURATO_BACKUP_DIR env var — used by tests to avoid writing to
 * real $HOME, and by users who want backups on a different volume.
 */
export function backupRoot() {
    return process.env['CURATO_BACKUP_DIR'] ?? join(homedir(), '.curato-backups');
}
/**
 * Create a timestamped backup of a file before mutation.
 * Backups are written to <backupRoot>/YYYYMMDD-HHmmss/<filename>.
 * Returns the backup directory path.
 */
export function backupFile(filePath) {
    const backupBase = join(backupRoot(), timestamp());
    mkdirSync(backupBase, { recursive: true });
    if (existsSync(filePath)) {
        copyFileSync(filePath, join(backupBase, basename(filePath)));
    }
    return backupBase;
}
//# sourceMappingURL=backup.js.map
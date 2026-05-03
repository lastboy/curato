/**
 * Root directory for backup archives. Defaults to ~/.curato-backups.
 * Override via CURATO_BACKUP_DIR env var — used by tests to avoid writing to
 * real $HOME, and by users who want backups on a different volume.
 */
export declare function backupRoot(): string;
/**
 * Create a timestamped backup of a file before mutation.
 * Backups are written to <backupRoot>/YYYYMMDD-HHmmss/<filename>.
 * Returns the backup directory path.
 */
export declare function backupFile(filePath: string): string;
//# sourceMappingURL=backup.d.ts.map
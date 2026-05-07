import { parseArgs } from 'node:util';
import { existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { backupRoot } from '../../patcher/backup.js';
import { ok, info, warn, dim, bold, line } from '../print.js';

const HELP = `
USAGE
  curato clean-backups [options]

OPTIONS
  --keep <N>    Keep the N most recent backups, delete the rest (default: 10)
  --all         Delete ALL backups
  --dry-run     Preview what would be deleted without deleting
  --help        Show this help

NOTES
  Backups in ~/.curato-backups/ may contain copies of settings.json with
  literal token values. Old backups should be cleaned periodically.

EXAMPLES
  curato clean-backups
  curato clean-backups --keep 5
  curato clean-backups --all --dry-run
`;

export async function cleanBackups(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      keep:      { type: 'string' },
      all:       { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help:      { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) { console.log(HELP); process.exit(0); }

  const root = backupRoot();
  if (!existsSync(root)) {
    info(`No backup directory found at ${root}`);
    return;
  }

  const entries = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, path: join(root, e.name), mtime: statSync(join(root, e.name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (entries.length === 0) {
    info(`No backups found in ${root}`);
    return;
  }

  const keep = values.all ? 0 : Number(values.keep ?? 10);
  if (!Number.isFinite(keep) || keep < 0) {
    throw new Error(`--keep must be a non-negative integer, got: ${values.keep}`);
  }

  const toDelete = entries.slice(keep);
  const toKeep = entries.slice(0, keep);

  bold(`\nBackups in ${root}`);
  line();
  dim(`  Found: ${entries.length}    Keeping: ${toKeep.length}    Deleting: ${toDelete.length}`);
  line();

  if (toDelete.length === 0) {
    ok('Nothing to delete.');
    return;
  }

  for (const entry of toDelete) {
    if (values['dry-run']) {
      dim(`  [dry-run] would delete: ${entry.name}`);
    } else {
      rmSync(entry.path, { recursive: true, force: true });
      info(`  deleted: ${entry.name}`);
    }
  }

  line();
  if (values['dry-run']) {
    warn(`Dry run — no files deleted. Re-run without --dry-run to apply.`);
  } else {
    ok(`Deleted ${toDelete.length} backup(s).`);
  }
}

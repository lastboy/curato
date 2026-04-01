import { register } from './index.js';
import { toolResult } from '../types.js';
import type { RepairReport, ApplySetupParams, RepairSetupParams } from '../types.js';
import { buildRepairProposals } from './recommend.js';
import { backupFile } from '../patcher/backup.js';
import { writeFile } from '../patcher/file-writer.js';
import { spawnSync } from 'node:child_process';

async function applyProposals(
  cwd: string,
  dryRun: boolean,
  targetIds?: string[],
): Promise<RepairReport> {
  const proposals = buildRepairProposals(cwd, targetIds);

  if (dryRun || proposals.length === 0) {
    return { dryRun, proposals, applied: [] };
  }

  // Backup all files that will be touched (before any writes)
  const touchedPaths = [...new Set(proposals.map((p) => p.targetPath))];
  const backupDirs = new Set<string>();
  for (const path of touchedPaths) {
    backupDirs.add(backupFile(path));
  }
  const backupDir = backupDirs.size > 0 ? [...backupDirs][0] : undefined;

  const applied = [];
  for (const proposal of proposals) {
    try {
      if (proposal.action === 'run-command' && proposal.command?.length) {
        const [cmd, ...args] = proposal.command;
        const r = spawnSync(cmd ?? '', args, { encoding: 'utf8' });
        if (r.status === 0) applied.push(proposal);
      } else {
        writeFile({
          path: proposal.targetPath,
          content: proposal.after,
          mode: proposal.action === 'append' ? 'append'
              : proposal.action === 'overwrite' ? 'overwrite'
              : 'create-if-missing',
          dryRun: false,
        });
        applied.push(proposal);
      }
    } catch {
      // skip failed writes — backup is already in place
    }
  }

  return { dryRun: false, proposals, applied, backupDir };
}

register(
  {
    name: 'apply_setup',
    description:
      'Apply all fixable items from a scan. Always creates a backup before writing. Use dryRun:true to preview changes without applying.',
    inputSchema: {
      type: 'object',
      required: ['dryRun'],
      properties: {
        cwd: {
          type: 'string',
          description: 'Working directory (defaults to process.cwd())',
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, return proposals without modifying any files',
        },
        targets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific check IDs to fix (omit to fix all fixable items)',
        },
      },
    },
  },
  async (args) => {
    const { cwd = process.cwd(), dryRun, targets } = (args as ApplySetupParams) ?? { dryRun: true };
    const report = await applyProposals(cwd, dryRun ?? true, targets);
    return toolResult(report);
  },
);

register(
  {
    name: 'repair_setup',
    description:
      'Fix specific check IDs returned by scan_environment. Always creates a backup before writing. Use dryRun:true to preview.',
    inputSchema: {
      type: 'object',
      required: ['checkIds', 'dryRun'],
      properties: {
        checkIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Check IDs to repair (from ScanReport.checks[].id)',
        },
        cwd: {
          type: 'string',
          description: 'Working directory (defaults to process.cwd())',
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, return proposals without modifying any files',
        },
      },
    },
  },
  async (args) => {
    const { checkIds = [], cwd = process.cwd(), dryRun } = (args as RepairSetupParams) ?? { dryRun: true, checkIds: [] };
    const report = await applyProposals(cwd, dryRun ?? true, checkIds.length > 0 ? checkIds : undefined);
    return toolResult(report);
  },
);

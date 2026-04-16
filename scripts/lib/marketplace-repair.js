// marketplace-repair.js
// Detects and removes stale curato-local entries in known_marketplaces.json.
//
// Background: older curato versions stored the marketplace source as a plain string path.
// Newer Claude Code validates source as a typed object and rejects the old format with:
//   "curato-local.source.source: Invalid input"
// This module removes the stale entry so `claude plugin marketplace add` can recreate it cleanly.
//
// Called by scripts/install.js on every install run — safe to call on clean machines.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * @typedef {{ repaired: true }} Repaired
 * @typedef {{ repaired: false; reason: 'file-not-found' | 'no-stale-entry' | 'parse-error' }} NotRepaired
 * @typedef {Repaired | NotRepaired} RepairResult
 */

/**
 * Inspect known_marketplaces.json and remove a stale curato-local entry if its
 * source.source value is not "directory" (the format current Claude Code expects).
 *
 * @param {string} knownMarketplacesPath  Absolute path to known_marketplaces.json
 * @returns {RepairResult}
 */
export function repairStaleMarketplaceEntry(knownMarketplacesPath) {
  if (!existsSync(knownMarketplacesPath)) {
    return { repaired: false, reason: 'file-not-found' };
  }

  let km;
  try {
    km = JSON.parse(readFileSync(knownMarketplacesPath, 'utf8'));
  } catch {
    return { repaired: false, reason: 'parse-error' };
  }

  const entry = km['curato-local'];
  const isStale =
    entry !== undefined &&
    entry !== null &&
    typeof entry.source === 'object' &&
    entry.source !== null &&
    typeof entry.source.source === 'string' &&
    entry.source.source !== 'directory';

  if (!isStale) {
    return { repaired: false, reason: 'no-stale-entry' };
  }

  delete km['curato-local'];
  writeFileSync(knownMarketplacesPath, JSON.stringify(km, null, 2) + '\n', 'utf8');
  return { repaired: true };
}

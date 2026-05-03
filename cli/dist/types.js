// ============================================================
// Core result types
// ============================================================
// ============================================================
// Status messages
// ============================================================
export const StatusMessages = {
    scanStart: 'Scanning environment...',
    scanDone: 'Scan complete.',
    repairStart: 'Preparing repairs...',
    repairDone: 'Repairs applied.',
    smokeStart: 'Running smoke test...',
    smokeDone: 'Smoke test complete.',
    dryRun: 'Dry-run mode — no changes will be applied.',
    backupNote: (dir) => `Backup created at ${dir} before making changes.`,
    operational: 'Curato is operational.',
    anomaly: (n) => `Detected ${n} anomal${n === 1 ? 'y' : 'ies'}.`,
};
// ============================================================
// MCP tool response helper
// ============================================================
export function toolResult(data) {
    return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
}
//# sourceMappingURL=types.js.map
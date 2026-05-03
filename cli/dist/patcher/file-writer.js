import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
/**
 * Write content to a file in the specified mode.
 * When dryRun:true, returns the proposed result without touching disk.
 */
export function writeFile(opts) {
    const { path, content, mode, dryRun } = opts;
    const exists = existsSync(path);
    const previous = exists ? readFileSync(path, 'utf8') : undefined;
    let finalContent = content;
    let written = false;
    if (mode === 'create-if-missing') {
        if (exists) {
            // File already exists — do nothing
            return { mode, path, dryRun, written: false, content: previous, previous };
        }
        finalContent = content;
    }
    else if (mode === 'append') {
        finalContent = exists ? `${previous}\n${content}` : content;
    }
    else if (mode === 'overwrite') {
        finalContent = content;
    }
    if (!dryRun) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, finalContent, 'utf8');
        written = true;
    }
    return { mode, path, dryRun, written, content: finalContent, previous };
}
//# sourceMappingURL=file-writer.js.map
export type WriteMode = 'create-if-missing' | 'append' | 'overwrite';
export interface WriteResult {
    mode: WriteMode;
    path: string;
    dryRun: boolean;
    written: boolean;
    content: string;
    previous?: string;
}
/**
 * Write content to a file in the specified mode.
 * When dryRun:true, returns the proposed result without touching disk.
 */
export declare function writeFile(opts: {
    path: string;
    content: string;
    mode: WriteMode;
    dryRun: boolean;
}): WriteResult;
//# sourceMappingURL=file-writer.d.ts.map
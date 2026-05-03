/**
 * Deep-merge two JSON objects.
 * - Target keys always win over source keys (additive/safe merge).
 * - Missing source keys are added to the result.
 * - Arrays are unioned (deduped by JSON-stringified value).
 * - Neither input object is mutated.
 */
export declare function safeMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown>;
//# sourceMappingURL=json-merger.d.ts.map
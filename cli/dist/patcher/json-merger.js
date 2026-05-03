function isPlainObject(val) {
    return typeof val === 'object' && val !== null && !Array.isArray(val);
}
/**
 * Deep-merge two JSON objects.
 * - Target keys always win over source keys (additive/safe merge).
 * - Missing source keys are added to the result.
 * - Arrays are unioned (deduped by JSON-stringified value).
 * - Neither input object is mutated.
 */
export function safeMerge(target, source) {
    const result = { ...target };
    for (const [key, sourceVal] of Object.entries(source)) {
        if (!(key in result)) {
            // Key only in source: add it
            result[key] = sourceVal;
        }
        else if (isPlainObject(result[key]) && isPlainObject(sourceVal)) {
            // Both objects: recurse
            result[key] = safeMerge(result[key], sourceVal);
        }
        else if (Array.isArray(result[key]) && Array.isArray(sourceVal)) {
            // Both arrays: union with dedup (by JSON stringified value)
            const combined = [
                ...result[key],
                ...sourceVal,
            ];
            const seen = new Set();
            result[key] = combined.filter((item) => {
                const key = JSON.stringify(item);
                if (seen.has(key))
                    return false;
                seen.add(key);
                return true;
            });
        }
        // else: target value wins — do nothing
    }
    return result;
}
//# sourceMappingURL=json-merger.js.map
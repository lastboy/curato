import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { safeMerge } from '../../patcher/json-merger.js';

describe('safeMerge', () => {
  test('target key wins when both have the same key', () => {
    const result = safeMerge({ a: 'original' }, { a: 'override' });
    assert.equal(result['a'], 'original');
  });

  test('source key is added when only source has it', () => {
    const result = safeMerge({ a: 1 }, { b: 2 });
    assert.equal(result['a'], 1);
    assert.equal(result['b'], 2);
  });

  test('arrays are unioned with deduplication', () => {
    const result = safeMerge({ items: ['a', 'b'] }, { items: ['b', 'c'] }) as { items: string[] };
    assert.ok(result.items.includes('a'));
    assert.ok(result.items.includes('b'));
    assert.ok(result.items.includes('c'));
    // No duplicates
    assert.equal(result.items.filter((x) => x === 'b').length, 1);
  });

  test('nested objects are recursively merged', () => {
    const result = safeMerge(
      { nested: { x: 1, y: 2 } },
      { nested: { y: 99, z: 3 } },
    ) as { nested: { x: number; y: number; z: number } };
    assert.equal(result.nested.x, 1);
    assert.equal(result.nested.y, 2);  // target wins
    assert.equal(result.nested.z, 3);  // source adds new key
  });

  test('does not mutate target object', () => {
    const target = { a: 1 };
    const targetRef = target;
    safeMerge(target, { b: 2 });
    assert.equal(target, targetRef);
    assert.equal(Object.keys(target).length, 1);
  });

  test('does not mutate source object', () => {
    const source = { b: 2 };
    safeMerge({ a: 1 }, source);
    assert.equal(Object.keys(source).length, 1);
    assert.equal(source['b'], 2);
  });

  test('empty source returns copy of target', () => {
    const result = safeMerge({ a: 1, b: 2 }, {});
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  test('empty target returns copy of source', () => {
    const result = safeMerge({}, { a: 1, b: 2 });
    assert.deepEqual(result, { a: 1, b: 2 });
  });

  test('deep array union dedupes objects by JSON value', () => {
    const obj = { id: 1 };
    const result = safeMerge(
      { items: [obj] },
      { items: [{ id: 1 }, { id: 2 }] },
    ) as { items: Array<{ id: number }> };
    assert.equal(result.items.length, 2);
    assert.ok(result.items.some((i) => i.id === 1));
    assert.ok(result.items.some((i) => i.id === 2));
  });
});

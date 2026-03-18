import { deepMerge } from './deepMerge.js';

suite('deepMerge', () => {
  test('merges flat objects', () => {
    const target = { a: 1, b: 2, c: 3 };
    const result = deepMerge(target, { a: 10 });
    expect(result).toEqual({ a: 10, b: 2, c: 3 });
  });

  test('merges nested objects recursively', () => {
    const target = { top: 'value', nested: { a: 1, b: 2, deep: { x: true, y: false } } };
    const result = deepMerge(target, { nested: { b: 99, deep: { y: true } } });
    expect(result).toEqual({ top: 'value', nested: { a: 1, b: 99, deep: { x: true, y: true } } });
  });

  test('replaces arrays entirely instead of merging', () => {
    const target = { items: [1, 2, 3], name: 'test' };
    const result = deepMerge(target, { items: [4, 5] });
    expect(result).toEqual({ items: [4, 5], name: 'test' });
  });

  test('allows null to override a value', () => {
    const target = { a: 'hello', b: 'world' } as { a: string | null; b: string };
    const result = deepMerge(target, { a: null });
    expect(result).toEqual({ a: null, b: 'world' });
  });

  test('explicit undefined overrides the default value', () => {
    const target = { a: 1, b: 2 };
    const result = deepMerge(target, { a: undefined });
    expect(result).toEqual({ a: undefined, b: 2 });
  });

  test('keeps defaults for properties not provided in source', () => {
    const target = { a: 1, b: 2, c: 3 };
    const result = deepMerge(target, { b: 20 });
    expect(result).toEqual({ a: 1, b: 20, c: 3 });
  });

  test('preserves functions unchanged', () => {
    const fn = (): string => 'hello';
    const target = { handler: fn, name: 'test' };
    const result = deepMerge(target, { name: 'updated' });
    expect(result.handler).toBe(fn);
  });

  test('allows overriding a function with another function', () => {
    const original = (): string => 'original';
    const replacement = (): string => 'replacement';
    const target: { handler: () => string } = { handler: original };
    const result = deepMerge(target, { handler: replacement });
    expect(result.handler).toBe(replacement);
  });

  test('does not mutate the target object', () => {
    const target = { nested: { a: 1, b: 2 } };
    const result = deepMerge(target, { nested: { a: 99 } });
    expect(target.nested.a).toBe(1);
    expect(result.nested.a).toBe(99);
  });

  test('handles empty source object', () => {
    const target = { a: 1, b: 2 };
    const result = deepMerge(target, {});
    expect(result).toEqual({ a: 1, b: 2 });
  });

  test('overrides primitives at any depth', () => {
    const target = { level1: { level2: { value: 'old' } } };
    const result = deepMerge(target, { level1: { level2: { value: 'new' } } });
    expect(result.level1.level2.value).toBe('new');
  });

  test('result is a new reference, not the same as target', () => {
    const target = { a: 1, b: 2 };
    const result = deepMerge(target, {});
    expect(result).not.toBe(target);
  });

  test('does not mutate nested target objects', () => {
    const innerDeep = { x: 'original' };
    const nested = { a: 1, deep: innerDeep };
    const target = { nested };
    const result = deepMerge(target, { nested: { deep: { x: 'changed' } } });

    expect(innerDeep.x).toBe('original');
    expect(nested.deep).toBe(innerDeep);
    expect(result.nested.deep).not.toBe(innerDeep);
    expect(result.nested.deep.x).toBe('changed');
  });

  test('null overrides a value at deep nesting', () => {
    const target = { a: { b: { c: 'value' } } } as { a: { b: { c: string | null } } };
    const result = deepMerge(target, { a: { b: { c: null } } });
    expect(result.a.b.c).toBeNull();
  });

  test('result nested objects are new references even when unchanged', () => {
    const target = { nested: { a: 1 } };
    const result = deepMerge(target, { nested: { a: 1 } });
    expect(result.nested).not.toBe(target.nested);
    expect(result.nested).toEqual(target.nested);
  });
});

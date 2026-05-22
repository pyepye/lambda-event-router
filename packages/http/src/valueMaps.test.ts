import { buildValueMaps } from './valueMaps.js';

suite('buildValueMaps', () => {
  test('builds both maps from a single-value source', () => {
    const { flat, multiValue } = buildValueMaps({ single: { page: '1', limit: '10' } });

    expect(flat).toEqual({ page: '1', limit: '10' });
    expect(multiValue).toEqual({ page: ['1'], limit: ['10'] });
  });

  test('builds both maps from a multi-value source, flat takes the last value', () => {
    const { flat, multiValue } = buildValueMaps({ multi: { tag: ['a', 'b', 'c'] } });

    expect(flat).toEqual({ tag: 'c' });
    expect(multiValue).toEqual({ tag: ['a', 'b', 'c'] });
  });

  test('preserves every repeated value in the multi-value map', () => {
    const { multiValue } = buildValueMaps({ multi: { tag: ['a', 'b'] } });

    expect(multiValue.tag).toEqual(['a', 'b']);
  });

  test('a multi-value source overrides a single-value source for the same key', () => {
    const { flat, multiValue } = buildValueMaps({
      single: { tag: 'single' },
      multi: { tag: ['multi-first', 'multi-last'] },
    });

    expect(flat.tag).toBe('multi-last');
    expect(multiValue.tag).toEqual(['multi-first', 'multi-last']);
  });

  test('skips empty multi-value arrays and keeps the single-value entry', () => {
    const { flat, multiValue } = buildValueMaps({
      single: { tag: 'from-single' },
      multi: { tag: [] },
    });

    expect(flat.tag).toBe('from-single');
    expect(multiValue.tag).toEqual(['from-single']);
  });

  test('lowercases keys when asked (headers are case-insensitive)', () => {
    const { flat, multiValue } = buildValueMaps({
      single: { 'Content-Type': 'application/json' },
      multi: { 'X-Custom': ['first', 'second'] },
      lowercaseKeys: true,
    });

    expect(flat['content-type']).toBe('application/json');
    expect(flat['x-custom']).toBe('second');
    expect(multiValue['x-custom']).toEqual(['first', 'second']);
  });

  test('preserves key case when not asked (query keys are case-sensitive)', () => {
    const { flat } = buildValueMaps({ single: { userId: '1' } });

    expect(flat).toEqual({ userId: '1' });
  });

  test('returns empty maps when given nothing', () => {
    const { flat, multiValue } = buildValueMaps({});

    expect(flat).toEqual({});
    expect(multiValue).toEqual({});
  });

  test('ignores null sources', () => {
    const { flat, multiValue } = buildValueMaps({ single: null, multi: null });

    expect(flat).toEqual({});
    expect(multiValue).toEqual({});
  });
});

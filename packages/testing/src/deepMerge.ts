import type { DeepPartial } from './deepPartial.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function deepMerge<T extends object>(target: T, source: DeepPartial<NoInfer<T>>): T {
  const result = { ...target } as Record<string, unknown>;
  const sourceRecord = source as Record<string, unknown>;

  for (const key of Object.keys(sourceRecord)) {
    const sourceValue = sourceRecord[key];
    const targetValue = result[key];

    if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }

  return result as T;
}

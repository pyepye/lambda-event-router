import { createMockSchema } from '@lambda-event-router/testing';

import { filterStringMatcher, isObject, safeJsonParse, validateSchema, validateSchemaResult } from './data.js';

suite('filterStringMatcher', () => {
  suite('plain string matcher', () => {
    test('returns true when matcher equals the test string', () => {
      expect(filterStringMatcher('user.created', 'user.created')).toBe(true);
    });

    test('returns false when matcher does not equal the test string', () => {
      expect(filterStringMatcher('user.created', 'user.updated')).toBe(false);
    });

    test('returns false when matcher is a partial match without wildcard', () => {
      expect(filterStringMatcher('user.created', 'user')).toBe(false);
      expect(filterStringMatcher('user.created', 'created')).toBe(false);
    });

    test('matches empty string against empty matcher', () => {
      expect(filterStringMatcher('', '')).toBe(true);
    });

    test('returns false for empty matcher against non-empty string', () => {
      expect(filterStringMatcher('user', '')).toBe(false);
    });

    test('treats regex special characters as literals', () => {
      expect(filterStringMatcher('a.b', 'a.b')).toBe(true);
      expect(filterStringMatcher('axb', 'a.b')).toBe(false);
      expect(filterStringMatcher('price+tax', 'price+tax')).toBe(true);
      expect(filterStringMatcher('price', 'price+tax')).toBe(false);
      expect(filterStringMatcher('group(1)', 'group(1)')).toBe(true);
      expect(filterStringMatcher('a|b', 'a|b')).toBe(true);
      expect(filterStringMatcher('a', 'a|b')).toBe(false);
      expect(filterStringMatcher('path\\to', 'path\\to')).toBe(true);
    });
  });

  suite('wildcard string matcher', () => {
    test('matches any suffix when wildcard is at the end', () => {
      expect(filterStringMatcher('user.created', 'user.*')).toBe(true);
      expect(filterStringMatcher('user.updated', 'user.*')).toBe(true);
      expect(filterStringMatcher('order.created', 'user.*')).toBe(false);
    });

    test('matches any prefix when wildcard is at the start', () => {
      expect(filterStringMatcher('user.created', '*.created')).toBe(true);
      expect(filterStringMatcher('order.created', '*.created')).toBe(true);
      expect(filterStringMatcher('user.updated', '*.created')).toBe(false);
    });

    test('matches middle segment with wildcard in the middle', () => {
      expect(filterStringMatcher('user.123.created', 'user.*.created')).toBe(true);
      expect(filterStringMatcher('user..created', 'user.*.created')).toBe(true);
      expect(filterStringMatcher('user.created', 'user.*.created')).toBe(false);
    });

    test('matches any string with a single wildcard', () => {
      expect(filterStringMatcher('anything', '*')).toBe(true);
      expect(filterStringMatcher('', '*')).toBe(true);
    });

    test('supports multiple wildcards', () => {
      expect(filterStringMatcher('user.123.created', '*.*.*')).toBe(true);
      expect(filterStringMatcher('user.created', '*.*.*')).toBe(false);
    });

    test('is anchored to the full string', () => {
      expect(filterStringMatcher('prefix-user.created-suffix', 'user.*')).toBe(false);
    });
  });

  suite('regex matcher', () => {
    test('returns true when the regex matches', () => {
      expect(filterStringMatcher('user.created', /^user\./)).toBe(true);
    });

    test('returns false when the regex does not match', () => {
      expect(filterStringMatcher('order.created', /^user\./)).toBe(false);
    });

    test('matches unanchored patterns anywhere in the string', () => {
      expect(filterStringMatcher('prefix-user-suffix', /user/)).toBe(true);
    });

    test('honours regex flags', () => {
      expect(filterStringMatcher('USER.CREATED', /^user\./i)).toBe(true);
      expect(filterStringMatcher('USER.CREATED', /^user\./)).toBe(false);
    });
  });

  suite('array of matchers', () => {
    test('returns true when any string in the array matches', () => {
      expect(filterStringMatcher('user.created', ['order.created', 'user.created'])).toBe(true);
    });

    test('returns false when no string in the array matches', () => {
      expect(filterStringMatcher('user.created', ['order.created', 'user.updated'])).toBe(false);
    });

    test('returns true when any regex in the array matches', () => {
      expect(filterStringMatcher('user.created', [/^order\./, /^user\./])).toBe(true);
    });

    test('returns false when no regex in the array matches', () => {
      expect(filterStringMatcher('user.created', [/^order\./, /^account\./])).toBe(false);
    });

    test('supports arrays of wildcard strings', () => {
      expect(filterStringMatcher('user.created', ['order.*', 'user.*'])).toBe(true);
      expect(filterStringMatcher('account.created', ['order.*', 'user.*'])).toBe(false);
    });

    test('supports mixed arrays of strings, wildcards, and regexes', () => {
      expect(filterStringMatcher('user.created', ['order.created', /^user\./])).toBe(true);
      expect(filterStringMatcher('user.created', ['order.*', /^account\./])).toBe(false);
      expect(filterStringMatcher('account.created', ['account.created', /^user\./])).toBe(true);
    });

    test('returns false for an empty array', () => {
      expect(filterStringMatcher('user.created', [])).toBe(false);
    });
  });
});

suite('isObject', () => {
  test('returns true for plain objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ key: 'value' })).toBe(true);
  });

  test('returns false for arrays', () => {
    expect(isObject([])).toBe(false);
    expect(isObject([1, 2, 3])).toBe(false);
  });

  test('returns false for null', () => {
    expect(isObject(null)).toBe(false);
  });

  test('returns false for primitives', () => {
    expect(isObject('string')).toBe(false);
    expect(isObject(123)).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(undefined)).toBe(false);
  });
});

suite('safeJsonParse', () => {
  test('returns undefined when input is undefined', () => {
    expect(safeJsonParse(undefined)).toBeUndefined();
  });

  test('returns undefined when input is empty string', () => {
    expect(safeJsonParse('')).toBeUndefined();
  });

  test('returns parsed object for valid JSON string', () => {
    const result = safeJsonParse('{"key":"value"}');
    expect(result).toEqual({ key: 'value' });
  });

  test('returns parsed array for valid JSON array string', () => {
    const result = safeJsonParse('[1,2,3]');
    expect(result).toEqual([1, 2, 3]);
  });

  test('returns the raw string when JSON parsing fails', () => {
    const invalidJson = 'not valid json';
    expect(safeJsonParse(invalidJson)).toBe(invalidJson);
  });
});

suite('validateSchema', () => {
  test('returns data unchanged when schema is undefined', async () => {
    const data = { taskId: 'task-123' };
    const result = await validateSchema(data, undefined);
    expect(result).toBe(data);
  });

  test('passes input data to schema validate function', async () => {
    const inputData = { taskId: 'task-123' };
    const schema = createMockSchema({ value: inputData });

    await validateSchema(inputData, schema);

    expect(schema['~standard'].validate).toHaveBeenCalledWith(inputData);
  });

  test('returns validated value when schema succeeds', async () => {
    const transformedData = { taskId: 'task-123', validated: true };
    const schema = createMockSchema({ value: transformedData });

    const result = await validateSchema({ taskId: 'task-123' }, schema);
    expect(result).toEqual(transformedData);
  });

  test('throws with default error message when validation fails', async () => {
    const issues = [{ message: 'field is required' }];
    const schema = createMockSchema({ issues });

    await expect(validateSchema({}, schema)).rejects.toThrow('Schema validation failed');
  });

  test('throws with custom error message when provided', async () => {
    const issues = [{ message: 'field is required' }];
    const schema = createMockSchema({ issues });

    await expect(validateSchema({}, schema, 'Custom error')).rejects.toThrow('Custom error');
  });

  test('includes issues as error cause', async () => {
    const issues = [{ message: 'field is required' }];
    const schema = createMockSchema({ issues });

    const error = await validateSchema({}, schema).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(Error);
    // @ts-expect-error - error is asserted as Error above
    expect(error.cause).toBe(issues);
  });
});

suite('validateSchemaResult', () => {
  test('returns success with original data when schema is undefined', async () => {
    const data = { taskId: 'task-123' };
    const result = await validateSchemaResult(data, undefined);
    expect(result).toEqual({ success: true, data });
  });

  test('returns success with validated value when schema succeeds', async () => {
    const transformedData = { taskId: 'task-123', validated: true };
    const schema = createMockSchema({ value: transformedData });

    const result = await validateSchemaResult({ taskId: 'task-123' }, schema);
    expect(result).toEqual({ success: true, data: transformedData });
  });

  test('returns failure with issues when validation fails', async () => {
    const issues = [{ message: 'field is required' }];
    const schema = createMockSchema({ issues });

    const result = await validateSchemaResult({}, schema);
    expect(result).toEqual({ success: false, issues });
  });
});

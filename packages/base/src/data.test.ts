import { createMockSchema } from '@lambda-event-router/testing';
import { isObject, safeJsonParse, validateSchema, validateSchemaResult } from './data.js';

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

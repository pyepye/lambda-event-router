import type { StandardSchemaV1 } from '@standard-schema/spec';

import { SchemaValidationError } from './SchemaValidationError.js';

const issues: StandardSchemaV1.Issue[] = [{ message: 'total is required', path: ['total'] }];

suite('SchemaValidationError', () => {
  test('keeps the message it was given', () => {
    const error = new SchemaValidationError('Data validation failed', issues);
    expect(error.message).toBe('Data validation failed');
    expect(error).toBeInstanceOf(Error);
  });

  test('names itself so a stack trace and a log both say what it is', () => {
    expect(new SchemaValidationError('nope', issues).name).toBe('SchemaValidationError');
    expect(String(new SchemaValidationError('nope', issues))).toBe('SchemaValidationError: nope');
  });

  test('carries the issues as an enumerable property, so a logger picks them up', () => {
    const error = new SchemaValidationError('nope', issues);
    expect(error.issues).toBe(issues);
    expect(Object.keys(error)).toContain('issues');
  });

  suite('isSchemaValidationError', () => {
    test('recognises its own instances', () => {
      expect(SchemaValidationError.isSchemaValidationError(new SchemaValidationError('nope', issues))).toBe(true);
    });

    test('recognises an instance from a second copy of this package', () => {
      class DuplicateSchemaValidationError extends Error {
        override readonly name = 'SchemaValidationError';
      }

      expect(SchemaValidationError.isSchemaValidationError(new DuplicateSchemaValidationError('nope'))).toBe(true);
    });

    test('rejects a plain error, a subclass with its own name, and a non-error', () => {
      class SomeOtherError extends Error {
        override readonly name = 'SomeOtherError';
      }

      expect(SchemaValidationError.isSchemaValidationError(new Error('Data validation failed'))).toBe(false);
      expect(SchemaValidationError.isSchemaValidationError(new SomeOtherError('nope'))).toBe(false);
      expect(SchemaValidationError.isSchemaValidationError({ name: 'SchemaValidationError' })).toBe(false);
      expect(SchemaValidationError.isSchemaValidationError(undefined)).toBe(false);
    });
  });
});

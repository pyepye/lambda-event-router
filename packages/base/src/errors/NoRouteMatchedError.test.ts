import { NoRouteMatchedError } from './NoRouteMatchedError.js';

suite('NoRouteMatchedError', () => {
  test('keeps the message it was given', () => {
    const error = new NoRouteMatchedError('No route matched for event');
    expect(error.message).toBe('No route matched for event');
    expect(error).toBeInstanceOf(Error);
  });

  test('names itself so a stack trace and a log both say what it is', () => {
    expect(new NoRouteMatchedError('nope').name).toBe('NoRouteMatchedError');
    expect(String(new NoRouteMatchedError('nope'))).toBe('NoRouteMatchedError: nope');
  });

  suite('isNoRouteMatchedError', () => {
    test('recognises its own instances', () => {
      expect(NoRouteMatchedError.isNoRouteMatchedError(new NoRouteMatchedError('nope'))).toBe(true);
    });

    test('recognises an instance from a second copy of this package', () => {
      // Matching on the name is the point: a duplicate copy in node_modules is a different class,
      // so instanceof would not see this one.
      class DuplicateNoRouteMatchedError extends Error {
        override readonly name = 'NoRouteMatchedError';
      }

      expect(NoRouteMatchedError.isNoRouteMatchedError(new DuplicateNoRouteMatchedError('nope'))).toBe(true);
    });

    test('rejects a plain error, a subclass with its own name, and a non-error', () => {
      class SomeOtherError extends Error {
        override readonly name = 'SomeOtherError';
      }

      expect(NoRouteMatchedError.isNoRouteMatchedError(new Error('No route matched for event'))).toBe(false);
      expect(NoRouteMatchedError.isNoRouteMatchedError(new SomeOtherError('nope'))).toBe(false);
      expect(NoRouteMatchedError.isNoRouteMatchedError({ name: 'NoRouteMatchedError' })).toBe(false);
      expect(NoRouteMatchedError.isNoRouteMatchedError(undefined)).toBe(false);
    });
  });
});

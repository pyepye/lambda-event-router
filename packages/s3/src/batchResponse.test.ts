import { isS3BatchResponse, PermanentFailure, Succeeded, TemporaryFailure } from './batchResponse.js';

suite('batchResponse', () => {
  suite('isS3BatchResponse', () => {
    test('returns false for non-object', () => {
      expect(isS3BatchResponse('string')).toBe(false);
    });

    test('returns false for null', () => {
      expect(isS3BatchResponse(null)).toBe(false);
    });

    test('returns false for object missing resultCode', () => {
      expect(isS3BatchResponse({ data: 'something' })).toBe(false);
    });

    test('returns false for non-string resultCode', () => {
      expect(isS3BatchResponse({ resultCode: 123 })).toBe(false);
    });

    test('returns false for invalid string resultCode', () => {
      expect(isS3BatchResponse({ resultCode: 'Invalid' })).toBe(false);
    });

    test('returns true for Succeeded', () => {
      expect(isS3BatchResponse({ resultCode: 'Succeeded' })).toBe(true);
    });

    test('returns true for TemporaryFailure', () => {
      expect(isS3BatchResponse({ resultCode: 'TemporaryFailure' })).toBe(true);
    });

    test('returns true for PermanentFailure', () => {
      expect(isS3BatchResponse({ resultCode: 'PermanentFailure' })).toBe(true);
    });
  });

  suite('Succeeded', () => {
    test('returns Succeeded with empty resultString when no args', () => {
      expect(Succeeded()).toEqual({ resultCode: 'Succeeded', resultString: '' });
    });

    test('returns Succeeded with provided resultString', () => {
      expect(Succeeded('done')).toEqual({ resultCode: 'Succeeded', resultString: 'done' });
    });
  });

  suite('TemporaryFailure', () => {
    test('returns TemporaryFailure with empty resultString when no args', () => {
      expect(TemporaryFailure()).toEqual({ resultCode: 'TemporaryFailure', resultString: '' });
    });

    test('returns TemporaryFailure with provided resultString', () => {
      expect(TemporaryFailure('retry later')).toEqual({ resultCode: 'TemporaryFailure', resultString: 'retry later' });
    });
  });

  suite('PermanentFailure', () => {
    test('returns PermanentFailure with empty resultString when no args', () => {
      expect(PermanentFailure()).toEqual({ resultCode: 'PermanentFailure', resultString: '' });
    });

    test('returns PermanentFailure with provided resultString', () => {
      expect(PermanentFailure('bad data')).toEqual({ resultCode: 'PermanentFailure', resultString: 'bad data' });
    });
  });
});

import { Dropped, Failed, isFirehoseResponse, Ok } from './response.js';

suite('response', () => {
  suite('isFirehoseResponse', () => {
    test('returns true for valid response with Ok status', () => {
      expect(isFirehoseResponse({ status: 'Ok' })).toBe(true);
    });

    test('returns true for valid response with Dropped status', () => {
      expect(isFirehoseResponse({ status: 'Dropped' })).toBe(true);
    });

    test('returns true for valid response with ProcessingFailed status', () => {
      expect(isFirehoseResponse({ status: 'ProcessingFailed' })).toBe(true);
    });

    test('returns false for null', () => {
      expect(isFirehoseResponse(null)).toBe(false);
    });

    test('returns false for non-object', () => {
      expect(isFirehoseResponse('string')).toBe(false);
    });

    test('returns false for missing status', () => {
      expect(isFirehoseResponse({ data: 'something' })).toBe(false);
    });

    test('returns false for invalid status', () => {
      expect(isFirehoseResponse({ status: 'Invalid' })).toBe(false);
    });
  });

  suite('Ok', () => {
    test('returns Ok status with no args', () => {
      const result = Ok();
      expect(result).toEqual({ status: 'Ok' });
    });

    test('returns base64-encoded data with string input', () => {
      const result = Ok('hello');
      const expectedData = Buffer.from('hello').toString('base64');
      expect(result).toEqual({ status: 'Ok', data: expectedData });
    });

    test('returns JSON-then-base64-encoded data with object input', () => {
      const input = { action: 'processOrder' };
      const result = Ok(input);
      const expectedData = Buffer.from(JSON.stringify(input)).toString('base64');
      expect(result).toEqual({ status: 'Ok', data: expectedData });
    });

    test('returns data and metadata when both provided', () => {
      const metadata = { partitionKeys: { key: 'value' } };
      const result = Ok('hello', metadata);
      const expectedData = Buffer.from('hello').toString('base64');
      expect(result).toEqual({ status: 'Ok', data: expectedData, metadata });
    });
  });

  suite('Dropped', () => {
    test('returns Dropped status', () => {
      expect(Dropped()).toEqual({ status: 'Dropped' });
    });
  });

  suite('Failed', () => {
    test('returns ProcessingFailed status', () => {
      expect(Failed()).toEqual({ status: 'ProcessingFailed' });
    });
  });
});

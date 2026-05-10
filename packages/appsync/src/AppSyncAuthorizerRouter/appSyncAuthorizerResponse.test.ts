import { Authorized, Denied, isAppSyncAuthorizerResponse } from './response.js';

suite('appSyncAuthorizerResponse', () => {
  suite('isAppSyncAuthorizerResponse', () => {
    test('returns true for an authorized response', () => {
      expect(isAppSyncAuthorizerResponse({ isAuthorized: true })).toBe(true);
    });

    test('returns true for a denied response', () => {
      expect(isAppSyncAuthorizerResponse({ isAuthorized: false })).toBe(true);
    });

    test('returns false for null', () => {
      expect(isAppSyncAuthorizerResponse(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(isAppSyncAuthorizerResponse('not a response')).toBe(false);
    });

    test('returns false for an object without isAuthorized', () => {
      expect(isAppSyncAuthorizerResponse({ something: 'else' })).toBe(false);
    });

    test('returns false when isAuthorized is not a boolean', () => {
      expect(isAppSyncAuthorizerResponse({ isAuthorized: 'yes' })).toBe(false);
    });
  });

  suite('Authorized', () => {
    test('returns an authorized response with no options', () => {
      expect(Authorized()).toEqual({ isAuthorized: true });
    });

    test('includes resolverContext when provided', () => {
      const result = Authorized({ resolverContext: { userId: '123' } });
      expect(result).toEqual({ isAuthorized: true, resolverContext: { userId: '123' } });
    });

    test('includes deniedFields when provided', () => {
      const result = Authorized({ deniedFields: ['User.email', 'User.phoneNumber'] });
      expect(result).toEqual({ isAuthorized: true, deniedFields: ['User.email', 'User.phoneNumber'] });
    });

    test('includes ttlOverride when provided', () => {
      const result = Authorized({ ttlOverride: 300 });
      expect(result).toEqual({ isAuthorized: true, ttlOverride: 300 });
    });

    test('includes every option when provided', () => {
      const result = Authorized({ resolverContext: { role: 'admin' }, deniedFields: ['User.email'], ttlOverride: 600 });
      expect(result).toEqual({
        isAuthorized: true,
        resolverContext: { role: 'admin' },
        deniedFields: ['User.email'],
        ttlOverride: 600,
      });
    });
  });

  suite('Denied', () => {
    test('returns a denied response with no options', () => {
      expect(Denied()).toEqual({ isAuthorized: false });
    });

    test('includes ttlOverride when provided', () => {
      const result = Denied({ ttlOverride: 60 });
      expect(result).toEqual({ isAuthorized: false, ttlOverride: 60 });
    });
  });
});

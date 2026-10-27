import { Allow, Authorized, Denied, Deny, isAuthorizerResponse } from './response.js';
import type { LambdaAuthorizerResult } from './types.js';

suite('lambdaAuthorizerResponse', () => {
  suite('isAuthorizerResponse', () => {
    test('returns true for a valid authorizer response', () => {
      const response = Allow('user-1', 'arn:aws:execute-api:*:*:*');
      expect(isAuthorizerResponse(response)).toBe(true);
    });

    test('returns false for null', () => {
      expect(isAuthorizerResponse(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(isAuthorizerResponse('not-a-response')).toBe(false);
    });

    test('returns false when principalId is missing', () => {
      expect(isAuthorizerResponse({ policyDocument: {} })).toBe(false);
    });

    test('returns false when policyDocument is missing', () => {
      expect(isAuthorizerResponse({ principalId: 'user-1' })).toBe(false);
    });

    test('returns false when principalId is not a string', () => {
      expect(isAuthorizerResponse({ principalId: 123, policyDocument: {} })).toBe(false);
    });

    test('returns false when policyDocument is not an object', () => {
      expect(isAuthorizerResponse({ principalId: 'user-1', policyDocument: 'invalid' })).toBe(false);
    });
  });

  suite('Allow', () => {
    test('generates an Allow policy', () => {
      const result = Allow('user-1', 'arn:aws:execute-api:*:*:*');

      expect(result).toEqual({
        principalId: 'user-1',
        policyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'execute-api:Invoke',
              Effect: 'Allow',
              Resource: 'arn:aws:execute-api:*:*:*',
            },
          ],
        },
      });
    });

    test('includes context when provided', () => {
      const result = Allow('user-1', 'arn:aws:execute-api:*:*:*', { role: 'admin', active: true });

      expect(result.context).toEqual({ role: 'admin', active: true });
    });

    test('omits context when not provided', () => {
      const result = Allow('user-1', 'arn:aws:execute-api:*:*:*');

      expect(result.context).toBeUndefined();
    });
  });

  suite('Deny', () => {
    test('generates a Deny policy', () => {
      const result = Deny('user-1', 'arn:aws:execute-api:*:*:*');

      expect(result).toEqual({
        principalId: 'user-1',
        policyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'execute-api:Invoke',
              Effect: 'Deny',
              Resource: 'arn:aws:execute-api:*:*:*',
            },
          ],
        },
      });
    });
  });

  suite('Authorized', () => {
    test('generates an allowing simple response', () => {
      expect(Authorized()).toEqual({ isAuthorized: true });
    });

    test('omits context when not provided', () => {
      expect(Authorized()).not.toHaveProperty('context');
    });

    test('includes context when provided', () => {
      const result = Authorized({ tenantId: 'acme', plan: 'pro' });

      expect(result).toEqual({ isAuthorized: true, context: { tenantId: 'acme', plan: 'pro' } });
    });

    test('carries arrays and nested maps', () => {
      const context = {
        stringKey: 'value',
        numberKey: 1,
        booleanKey: true,
        arrayKey: ['value1', 'value2'],
        mapKey: { value1: 'value2' },
      };

      expect(Authorized(context)).toEqual({ isAuthorized: true, context });
    });
  });

  suite('Denied', () => {
    test('generates a refusing simple response', () => {
      expect(Denied()).toEqual({ isAuthorized: false });
    });
  });

  suite('LambdaAuthorizerResult', () => {
    test('accepts a simple response carrying a context', () => {
      const result: LambdaAuthorizerResult = {
        isAuthorized: true,
        context: { tenantId: 'acme', limits: { rpm: 60 } },
      };

      expect(result).toEqual({ isAuthorized: true, context: { tenantId: 'acme', limits: { rpm: 60 } } });
    });

    test('checks the context against a declared shape', () => {
      // @ts-expect-error tenantId is the declared key, so the typo does not compile
      const result: LambdaAuthorizerResult<{ tenantId: string }> = {
        isAuthorized: true,
        context: { tenntId: 'acme' },
      };

      expect(result).toEqual({ isAuthorized: true, context: { tenntId: 'acme' } });
    });

    test('rejects a context value JSON cannot carry', () => {
      const result: LambdaAuthorizerResult = {
        isAuthorized: true,
        // @ts-expect-error a Date is not a JsonValue
        context: { since: new Date('2026-09-17') },
      };

      expect(result).toEqual({ isAuthorized: true, context: { since: new Date('2026-09-17') } });
    });
  });
});

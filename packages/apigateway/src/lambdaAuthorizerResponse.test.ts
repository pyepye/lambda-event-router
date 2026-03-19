import { Allow, Deny, isAuthorizerResponse } from './lambdaAuthorizerResponse.js';

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
});

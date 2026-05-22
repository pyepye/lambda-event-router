import { createApiGatewayV1Event } from '@lambda-event-router/testing';

import { apiGatewayV1Adapter } from './apiGatewayV1Adapter.js';

suite('apiGatewayV1Adapter', () => {
  suite('canHandleEvent', () => {
    test('returns true for a valid V1 event', () => {
      const event = createApiGatewayV1Event();
      expect(apiGatewayV1Adapter.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(apiGatewayV1Adapter.canHandleEvent(null)).toBe(false);
    });

    test('returns false when httpMethod is missing', () => {
      expect(apiGatewayV1Adapter.canHandleEvent({ path: '/', requestContext: {} })).toBe(false);
    });

    test('returns false when path is missing', () => {
      expect(apiGatewayV1Adapter.canHandleEvent({ httpMethod: 'GET', requestContext: {} })).toBe(false);
    });

    test('returns false when requestContext is missing', () => {
      expect(apiGatewayV1Adapter.canHandleEvent({ httpMethod: 'GET', path: '/' })).toBe(false);
    });

    test('returns false for a V2 event (has rawPath)', () => {
      expect(
        apiGatewayV1Adapter.canHandleEvent({ httpMethod: 'GET', path: '/', rawPath: '/', requestContext: {} }),
      ).toBe(false);
    });

    test('returns false for an ALB event (has requestContext.elb)', () => {
      expect(
        apiGatewayV1Adapter.canHandleEvent({
          httpMethod: 'GET',
          path: '/',
          requestContext: { elb: { targetGroupArn: 'arn:aws:elasticloadbalancing:us-east-1:123:targetgroup/my-tg' } },
        }),
      ).toBe(false);
    });
  });

  suite('normalize', () => {
    test('extracts method, path, body from V1 event', () => {
      const event = createApiGatewayV1Event({
        httpMethod: 'POST',
        path: '/items',
        body: '{"name":"test"}',
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.method).toBe('POST');
      expect(normalized.path).toBe('/items');
      expect(normalized.body).toBe('{"name":"test"}');
    });

    test('handles null headers', () => {
      const event = createApiGatewayV1Event();
      // @ts-expect-error - headers can be null in real V1 events
      event.headers = null;

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.headers).toEqual({});
    });

    test('handles null multiValueHeaders', () => {
      const event = createApiGatewayV1Event();
      // @ts-expect-error - AWS does not allow null here, do we need this test
      event.multiValueHeaders = null;

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.headers).toEqual({});
    });

    test('skips multiValueHeaders entries with null or empty values', () => {
      const event = createApiGatewayV1Event({
        multiValueHeaders: {
          'X-Empty': [],
          // @ts-expect-error - values can be null in the AWS type
          'X-Null': null,
        },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.headers['x-empty']).toBeUndefined();
      expect(normalized.headers['x-null']).toBeUndefined();
    });

    test('flattens headers to lowercase', () => {
      const event = createApiGatewayV1Event({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.headers['content-type']).toBe('application/json');
      expect(normalized.headers.authorization).toBe('Bearer token');
    });

    test('returns empty query when queryStringParameters is null', () => {
      const event = createApiGatewayV1Event();

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.query).toEqual({});
    });

    test('passes through query string parameters', () => {
      const event = createApiGatewayV1Event({
        queryStringParameters: { page: '1', limit: '10' },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.query).toEqual({ page: '1', limit: '10' });
    });

    test('reads repeated query params from multiValueQueryStringParameters', () => {
      const event = createApiGatewayV1Event({
        queryStringParameters: { tag: 'b' },
        multiValueQueryStringParameters: { tag: ['a', 'b'] },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.query).toEqual({ tag: 'b' });
      expect(normalized.multiValueQuery).toEqual({ tag: ['a', 'b'] });
    });

    test('exposes repeated headers from multiValueHeaders', () => {
      const event = createApiGatewayV1Event({
        multiValueHeaders: { 'Set-Cookie': ['a=1', 'b=2'] },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.multiValueHeaders['set-cookie']).toEqual(['a=1', 'b=2']);
    });

    test('returns undefined body when event body is null', () => {
      const event = createApiGatewayV1Event();

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.body).toBeUndefined();
    });

    test('extracts Cognito authorizer claims', () => {
      const event = createApiGatewayV1Event({
        requestContext: {
          authorizer: {
            claims: { sub: 'user-1', email: 'test@example.com' },
          },
        },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.auth).toEqual({
        claims: { sub: 'user-1', email: 'test@example.com' },
      });
    });

    test('extracts Lambda authorizer with principalId', () => {
      const event = createApiGatewayV1Event({
        requestContext: {
          authorizer: {
            principalId: 'user-1',
            role: 'admin',
          },
        },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.auth).toEqual({
        principalId: 'user-1',
        context: { role: 'admin' },
      });
    });

    test('uses last value from multiValueHeaders', () => {
      const event = createApiGatewayV1Event({
        multiValueHeaders: {
          'X-Custom': ['first', 'second', 'third'],
        },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.headers['x-custom']).toBe('third');
    });

    test('extracts apiKey identity auth', () => {
      const event = createApiGatewayV1Event({
        requestContext: {
          identity: {
            apiKey: 'my-api-key',
            apiKeyId: 'key-id-123',
          },
        },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.auth).toEqual({
        apiKey: 'my-api-key',
        apiKeyId: 'key-id-123',
      });
    });

    test('extracts apiKey auth with undefined apiKeyId when null', () => {
      const event = createApiGatewayV1Event({
        requestContext: {
          identity: {
            apiKey: 'my-api-key',
          },
        },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.auth).toEqual({
        apiKey: 'my-api-key',
        apiKeyId: undefined,
      });
    });

    test('extracts Cognito identity auth when authenticated', () => {
      const event = createApiGatewayV1Event({
        requestContext: {
          identity: {
            cognitoAuthenticationType: 'authenticated',
            cognitoIdentityId: 'us-east-1:identity-id',
            cognitoIdentityPoolId: 'us-east-1:pool-id',
            accountId: '123456789012',
            caller: 'caller-id',
            sourceIp: '10.0.0.1',
            userArn: 'arn:aws:iam::123456789012:user/test',
          },
        },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.auth).toEqual({
        iam: {
          cognitoIdentityId: 'us-east-1:identity-id',
          cognitoIdentityPoolId: 'us-east-1:pool-id',
          accountId: '123456789012',
          caller: 'caller-id',
          sourceIp: '10.0.0.1',
          userArn: 'arn:aws:iam::123456789012:user/test',
        },
      });
    });

    test('returns default authorizer context when authorizer is not Cognito or Lambda', () => {
      const event = createApiGatewayV1Event({
        requestContext: {
          authorizer: {
            customKey: 'customValue',
          },
        },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.auth).toEqual({
        context: { customKey: 'customValue' },
      });
    });

    test('returns undefined auth when no authorizer is present', () => {
      const event = createApiGatewayV1Event();

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.auth).toBeUndefined();
    });
  });

  suite('buildResult', () => {
    test('converts finalized response to API Gateway V1 result', () => {
      const event = createApiGatewayV1Event();
      const response = { statusCode: 200, body: '{"ok":true}', headers: { 'x-custom': 'value' } };

      const result = apiGatewayV1Adapter.buildResult(response, event);

      expect(result).toEqual({
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
      });
    });
  });
});

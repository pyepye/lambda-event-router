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

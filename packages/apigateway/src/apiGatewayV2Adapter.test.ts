import { createApiGatewayV2Event } from '@lambda-event-router/testing';
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type { APIGatewayV2EventType } from './apiGatewayV2Adapter.js';
import { apiGatewayV2Adapter } from './apiGatewayV2Adapter.js';

suite('apiGatewayV2Adapter', () => {
  suite('canHandleEvent', () => {
    test('returns true for a valid V2 event', () => {
      const event = createApiGatewayV2Event();
      expect(apiGatewayV2Adapter.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(apiGatewayV2Adapter.canHandleEvent(null)).toBe(false);
    });

    test('returns false when rawPath is missing', () => {
      expect(apiGatewayV2Adapter.canHandleEvent({ requestContext: { http: { method: 'GET' } } })).toBe(false);
    });

    test('returns false when requestContext.http is missing', () => {
      expect(apiGatewayV2Adapter.canHandleEvent({ rawPath: '/', requestContext: {} })).toBe(false);
    });

    test('returns false when http.method is not a string', () => {
      expect(apiGatewayV2Adapter.canHandleEvent({ rawPath: '/', requestContext: { http: { method: 123 } } })).toBe(
        false,
      );
    });
  });

  suite('normalize', () => {
    test('extracts method, path, headers, query, body from V2 event', () => {
      const event = createApiGatewayV2Event({
        rawPath: '/items',
        headers: { 'content-type': 'application/json' },
        queryStringParameters: { page: '1' },
        body: '{"name":"test"}',
        requestContext: { http: { method: 'POST' } },
      });

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.method).toBe('POST');
      expect(normalized.path).toBe('/items');
      expect(normalized.headers).toEqual({ 'content-type': 'application/json' });
      expect(normalized.query).toEqual({ page: '1' });
      expect(normalized.body).toBe('{"name":"test"}');
      expect(normalized.isBase64Encoded).toBe(false);
    });

    test('returns empty query when queryStringParameters is undefined', () => {
      const event = createApiGatewayV2Event();

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.query).toEqual({});
    });

    test('extracts JWT auth from V2 event', () => {
      const baseEvent = createApiGatewayV2Event();
      const event: APIGatewayV2EventType = {
        ...baseEvent,
        requestContext: {
          ...baseEvent.requestContext,
          authorizer: {
            principalId: 'user-1',
            integrationLatency: 100,
            jwt: {
              claims: { sub: 'user-1', iss: 'https://cognito.example.com' },
              scopes: ['openid', 'email'],
            },
          },
        },
      } as APIGatewayProxyEventV2WithJWTAuthorizer;

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.auth).toEqual({
        claims: { sub: 'user-1', iss: 'https://cognito.example.com' },
        scopes: ['openid', 'email'],
      });
    });

    test('returns undefined auth when no authorizer is present', () => {
      const event = createApiGatewayV2Event();

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.auth).toBeUndefined();
    });
  });

  suite('buildResult', () => {
    test('converts finalized response to API Gateway V2 result', () => {
      const event = createApiGatewayV2Event();
      const response = { statusCode: 200, body: '{"ok":true}', headers: { 'x-custom': 'value' } };

      const result = apiGatewayV2Adapter.buildResult(response, event);

      expect(result).toEqual({
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
      });
    });
  });
});

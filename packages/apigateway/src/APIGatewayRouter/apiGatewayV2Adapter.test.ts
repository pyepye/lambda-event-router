import { createApiGatewayLambdaAuthorizerRequestV2Event, createApiGatewayV2Event } from '@lambda-event-router/testing';

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

    test('returns false for a REQUEST authorizer event', () => {
      const event = createApiGatewayLambdaAuthorizerRequestV2Event();
      expect(apiGatewayV2Adapter.canHandleEvent(event)).toBe(false);
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

    test('keeps V2 comma-joined values as a single multi-value entry (no comma splitting)', () => {
      // API Gateway V2 joins repeated params itself; it is not split back apart
      const event = createApiGatewayV2Event({
        headers: { 'x-tag': 'a,b' },
        queryStringParameters: { tag: 'a,b' },
      });

      const normalized = apiGatewayV2Adapter.normalize(event);

      expect(normalized.query).toEqual({ tag: 'a,b' });
      expect(normalized.multiValueQuery).toEqual({ tag: ['a,b'] });
      expect(normalized.multiValueHeaders['x-tag']).toEqual(['a,b']);
    });
  });

  suite('buildResult', () => {
    test('converts finalized response to API Gateway V2 result', () => {
      const event = createApiGatewayV2Event();
      const response = {
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
        isBase64Encoded: false,
      };

      const result = apiGatewayV2Adapter.buildResult(response, event);

      expect(result).toEqual({
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
        isBase64Encoded: false,
      });
    });

    test('passes a base64 body through with its flag', () => {
      const event = createApiGatewayV2Event();
      const body = Buffer.from([0x00, 0x01]).toString('base64');

      const result = apiGatewayV2Adapter.buildResult({ statusCode: 200, body, isBase64Encoded: true }, event);

      expect(result).toEqual({ statusCode: 200, body, headers: undefined, isBase64Encoded: true });
    });
  });
});

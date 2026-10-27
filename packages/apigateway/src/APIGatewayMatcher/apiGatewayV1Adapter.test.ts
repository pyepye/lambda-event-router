import { createApiGatewayLambdaAuthorizerRequestV1Event, createApiGatewayV1Event } from '@latcher/testing';

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

    test('returns false for a REQUEST authorizer event', () => {
      const event = createApiGatewayLambdaAuthorizerRequestV1Event();
      expect(apiGatewayV1Adapter.canHandleEvent(event)).toBe(false);
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

    test('uses last value from multiValueHeaders', () => {
      const event = createApiGatewayV1Event({
        multiValueHeaders: {
          'X-Custom': ['first', 'second', 'third'],
        },
      });

      const normalized = apiGatewayV1Adapter.normalize(event);

      expect(normalized.headers['x-custom']).toBe('third');
    });
  });

  suite('buildResult', () => {
    test('converts finalized response to API Gateway V1 result', () => {
      const event = createApiGatewayV1Event();
      const response = {
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
        isBase64Encoded: false,
      };

      const result = apiGatewayV1Adapter.buildResult(response, event);

      expect(result).toEqual({
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
        isBase64Encoded: false,
      });
    });

    test('passes a base64 body through with its flag', () => {
      const event = createApiGatewayV1Event();
      const body = Buffer.from([0x00, 0x01]).toString('base64');

      const result = apiGatewayV1Adapter.buildResult({ statusCode: 200, body, isBase64Encoded: true }, event);

      expect(result.body).toBe(body);
      expect(result.isBase64Encoded).toBe(true);
    });
  });
});

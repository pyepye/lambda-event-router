import { createApiGatewayV1Event, createApiGatewayV2Event } from '@lambda-event-router/testing';
import { apiGatewayAdapter } from './apiGatewayAdapter.js';

suite('apiGatewayAdapter', () => {
  suite('canHandleEvent', () => {
    test('returns true for a V2 event', () => {
      const event = createApiGatewayV2Event();
      expect(apiGatewayAdapter.canHandleEvent(event)).toBe(true);
    });

    test('returns true for a V1 event', () => {
      const event = createApiGatewayV1Event();
      expect(apiGatewayAdapter.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(apiGatewayAdapter.canHandleEvent(null)).toBe(false);
    });

    test('returns false for an unrelated event', () => {
      expect(apiGatewayAdapter.canHandleEvent({ Records: [] })).toBe(false);
    });
  });

  suite('normalize', () => {
    test('delegates to V2 adapter for V2 events', () => {
      const event = createApiGatewayV2Event({ rawPath: '/v2-path', requestContext: { http: { method: 'GET' } } });

      const normalized = apiGatewayAdapter.normalize(event);

      expect(normalized.path).toBe('/v2-path');
      expect(normalized.method).toBe('GET');
    });

    test('delegates to V1 adapter for V1 events', () => {
      const event = createApiGatewayV1Event({ path: '/v1-path', httpMethod: 'POST' });

      const normalized = apiGatewayAdapter.normalize(event);

      expect(normalized.path).toBe('/v1-path');
      expect(normalized.method).toBe('POST');
    });
  });

  suite('buildResult', () => {
    test('delegates to V2 adapter for V2 events', () => {
      const event = createApiGatewayV2Event();
      const response = { statusCode: 200, body: 'ok' };

      const result = apiGatewayAdapter.buildResult(response, event);

      expect(result).toEqual({ statusCode: 200, body: 'ok', headers: undefined });
    });

    test('delegates to V1 adapter for V1 events', () => {
      const event = createApiGatewayV1Event();
      const response = { statusCode: 200, body: 'ok' };

      const result = apiGatewayAdapter.buildResult(response, event);

      expect(result).toEqual({ statusCode: 200, body: 'ok', headers: undefined });
    });
  });
});

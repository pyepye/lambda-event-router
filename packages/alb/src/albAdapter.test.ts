import { createALBEvent } from '@lambda-event-router/testing';

import { albAdapter } from './albAdapter.js';

suite('albAdapter', () => {
  suite('canHandleEvent', () => {
    test('returns true for a valid ALB event', () => {
      const event = createALBEvent();
      expect(albAdapter.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(albAdapter.canHandleEvent(null)).toBe(false);
    });

    test('returns false when path is missing', () => {
      expect(albAdapter.canHandleEvent({ httpMethod: 'GET', requestContext: { elb: {} } })).toBe(false);
    });

    test('returns false when path is not a string', () => {
      expect(albAdapter.canHandleEvent({ path: 123, httpMethod: 'GET', requestContext: { elb: {} } })).toBe(false);
    });

    test('returns false when httpMethod is missing', () => {
      expect(albAdapter.canHandleEvent({ path: '/', requestContext: { elb: {} } })).toBe(false);
    });

    test('returns false when httpMethod is not a string', () => {
      expect(albAdapter.canHandleEvent({ path: '/', httpMethod: 123, requestContext: { elb: {} } })).toBe(false);
    });

    test('returns false when requestContext is missing', () => {
      expect(albAdapter.canHandleEvent({ path: '/', httpMethod: 'GET' })).toBe(false);
    });

    test('returns false when requestContext is not an object', () => {
      expect(albAdapter.canHandleEvent({ path: '/', httpMethod: 'GET', requestContext: 'bad' })).toBe(false);
    });

    test('returns false when requestContext.elb is missing', () => {
      expect(albAdapter.canHandleEvent({ path: '/', httpMethod: 'GET', requestContext: {} })).toBe(false);
    });

    test('returns false when requestContext.elb is not an object', () => {
      expect(albAdapter.canHandleEvent({ path: '/', httpMethod: 'GET', requestContext: { elb: 'bad' } })).toBe(false);
    });

    test('returns false when requestContext.serviceArn is a string (VPCLatticeV2 guard)', () => {
      expect(
        albAdapter.canHandleEvent({
          path: '/',
          httpMethod: 'GET',
          requestContext: { elb: {}, serviceArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:service/svc-123' },
        }),
      ).toBe(false);
    });
  });

  suite('normalize', () => {
    test('extracts method, path, body from ALB event', () => {
      const event = createALBEvent({
        httpMethod: 'POST',
        path: '/items',
        body: '{"name":"test"}',
      });

      const normalized = albAdapter.normalize(event);

      expect(normalized.method).toBe('POST');
      expect(normalized.path).toBe('/items');
      expect(normalized.body).toBe('{"name":"test"}');
    });

    test('flattens headers to lowercase', () => {
      const event = createALBEvent({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      });

      const normalized = albAdapter.normalize(event);

      expect(normalized.headers['content-type']).toBe('application/json');
      expect(normalized.headers.authorization).toBe('Bearer token');
    });

    test('handles multiValueHeaders (takes last value, lowercased key)', () => {
      const event = createALBEvent({
        multiValueHeaders: { 'X-Custom': ['first', 'second'] },
      });

      const normalized = albAdapter.normalize(event);

      expect(normalized.headers['x-custom']).toBe('second');
    });

    test('returns empty query when queryStringParameters is null', () => {
      const event = createALBEvent();

      const normalized = albAdapter.normalize(event);

      expect(normalized.query).toEqual({});
    });

    test('passes through query string parameters', () => {
      const event = createALBEvent({
        queryStringParameters: { page: '1', limit: '10' },
      });

      const normalized = albAdapter.normalize(event);

      expect(normalized.query).toEqual({ page: '1', limit: '10' });
    });

    test('returns undefined body when event body is null', () => {
      const event = createALBEvent();

      const normalized = albAdapter.normalize(event);

      expect(normalized.body).toBeUndefined();
    });

    test('preserves isBase64Encoded', () => {
      const event = createALBEvent({ isBase64Encoded: true });

      const normalized = albAdapter.normalize(event);

      expect(normalized.isBase64Encoded).toBe(true);
    });

    test('extracts targetGroupArn into auth', () => {
      const event = createALBEvent({
        requestContext: {
          elb: {
            targetGroupArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/my-tg/50dc6c495c0c9188',
          },
        },
      });

      const normalized = albAdapter.normalize(event);

      expect(normalized.auth).toEqual({
        targetGroupArn: 'arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/my-tg/50dc6c495c0c9188',
      });
    });

    test('returns empty headers when both headers and multiValueHeaders are undefined', () => {
      const event = createALBEvent();
      event.headers = undefined;

      const normalized = albAdapter.normalize(event);

      expect(normalized.headers).toEqual({});
    });

    test('skips multiValueHeaders entries with empty arrays', () => {
      const event = createALBEvent({
        headers: { 'X-Custom': 'from-single' },
        multiValueHeaders: { 'X-Custom': [] },
      });

      const normalized = albAdapter.normalize(event);

      expect(normalized.headers['x-custom']).toBe('from-single');
    });

    test('multiValueHeaders override single-value headers for same key', () => {
      const event = createALBEvent({
        headers: { 'X-Custom': 'single' },
        multiValueHeaders: { 'X-Custom': ['multi-first', 'multi-last'] },
      });

      const normalized = albAdapter.normalize(event);

      expect(normalized.headers['x-custom']).toBe('multi-last');
    });
  });

  suite('buildResult', () => {
    test('converts finalized response to ALB result', () => {
      const event = createALBEvent();
      const response = { statusCode: 200, body: '{"ok":true}', headers: { 'x-custom': 'value' } };

      const result = albAdapter.buildResult(response, event);

      expect(result).toEqual({
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
      });
    });
  });
});

import { createVPCLatticeV2Event } from '@lambda-event-router/testing';

import { vpcLatticeV2Adapter } from './vpcLatticeV2Adapter.js';

suite('vpcLatticeV2Adapter', () => {
  suite('canHandleEvent', () => {
    test('returns true for a valid V2 event', () => {
      const event = createVPCLatticeV2Event();
      expect(vpcLatticeV2Adapter.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(vpcLatticeV2Adapter.canHandleEvent(null)).toBe(false);
    });

    test('returns false when path is missing', () => {
      expect(
        vpcLatticeV2Adapter.canHandleEvent({
          method: 'GET',
          version: '2.0',
          requestContext: { serviceArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:service/svc-123' },
        }),
      ).toBe(false);
    });

    test('returns false when method is missing', () => {
      expect(
        vpcLatticeV2Adapter.canHandleEvent({
          path: '/',
          version: '2.0',
          requestContext: { serviceArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:service/svc-123' },
        }),
      ).toBe(false);
    });

    test('returns false when version is not 2.0', () => {
      expect(
        vpcLatticeV2Adapter.canHandleEvent({
          method: 'GET',
          path: '/',
          version: '1.0',
          requestContext: { serviceArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:service/svc-123' },
        }),
      ).toBe(false);
    });

    test('returns false when requestContext is missing', () => {
      expect(vpcLatticeV2Adapter.canHandleEvent({ method: 'GET', path: '/', version: '2.0' })).toBe(false);
    });

    test('returns false when requestContext is not an object', () => {
      expect(
        vpcLatticeV2Adapter.canHandleEvent({ method: 'GET', path: '/', version: '2.0', requestContext: 'bad' }),
      ).toBe(false);
    });

    test('returns false when requestContext.serviceArn is missing', () => {
      expect(
        vpcLatticeV2Adapter.canHandleEvent({
          method: 'GET',
          path: '/',
          version: '2.0',
          requestContext: {},
        }),
      ).toBe(false);
    });

    test('returns false when requestContext.elb is present', () => {
      expect(
        vpcLatticeV2Adapter.canHandleEvent({
          method: 'GET',
          path: '/',
          version: '2.0',
          requestContext: {
            serviceArn: 'arn:aws:vpc-lattice:us-east-1:123456789012:service/svc-123',
            elb: { targetGroupArn: 'arn' },
          },
        }),
      ).toBe(false);
    });
  });

  suite('normalize', () => {
    test('extracts method, path, headers, query, body from V2 event', () => {
      const event = createVPCLatticeV2Event({
        method: 'POST',
        path: '/items',
        headers: { 'content-type': ['application/json'] },
        queryStringParameters: { page: ['1'] },
        body: '{"name":"test"}',
      });

      const normalized = vpcLatticeV2Adapter.normalize(event);

      expect(normalized.method).toBe('POST');
      expect(normalized.path).toBe('/items');
      expect(normalized.headers).toEqual({ 'content-type': 'application/json' });
      expect(normalized.query).toEqual({ page: '1' });
      expect(normalized.body).toBe('{"name":"test"}');
      expect(normalized.isBase64Encoded).toBe(false);
    });

    test('flattens array headers to comma-joined lowercase values', () => {
      const event = createVPCLatticeV2Event({
        headers: { Accept: ['text/html', 'application/json'] },
      });

      const normalized = vpcLatticeV2Adapter.normalize(event);

      expect(normalized.headers.accept).toBe('text/html,application/json');
    });

    test('flattens array query params to comma-joined values', () => {
      const event = createVPCLatticeV2Event({
        queryStringParameters: { tags: ['a', 'b', 'c'] },
      });

      const normalized = vpcLatticeV2Adapter.normalize(event);

      expect(normalized.query).toEqual({ tags: 'a,b,c' });
    });

    test('preserves query key case', () => {
      const event = createVPCLatticeV2Event({
        queryStringParameters: { orderId: ['9'], Mixed: ['Case'] },
      });

      const normalized = vpcLatticeV2Adapter.normalize(event);

      expect(normalized.query).toEqual({ orderId: '9', Mixed: 'Case' });
    });

    test('returns empty headers when headers is undefined', () => {
      const event = createVPCLatticeV2Event({ headers: undefined });

      const normalized = vpcLatticeV2Adapter.normalize(event);

      expect(normalized.headers).toEqual({});
    });

    test('returns empty query when queryStringParameters is undefined', () => {
      const event = createVPCLatticeV2Event();

      const normalized = vpcLatticeV2Adapter.normalize(event);

      expect(normalized.query).toEqual({});
    });

    test('returns undefined body when event body is undefined', () => {
      const event = createVPCLatticeV2Event();
      const normalized = vpcLatticeV2Adapter.normalize(event);
      expect(normalized.body).toBeUndefined();
    });

    test('extracts auth from requestContext.identity.principal', () => {
      const event = createVPCLatticeV2Event({
        requestContext: {
          identity: { principal: 'arn:aws:iam::123456789012:role/my-role' },
        },
      });

      const normalized = vpcLatticeV2Adapter.normalize(event);

      expect(normalized.auth).toEqual({ principalId: 'arn:aws:iam::123456789012:role/my-role' });
    });

    test('returns undefined auth when no identity is present', () => {
      const event = createVPCLatticeV2Event();

      const normalized = vpcLatticeV2Adapter.normalize(event);

      expect(normalized.auth).toBeUndefined();
    });
  });

  suite('buildResult', () => {
    test('converts finalized response to VPC Lattice result', () => {
      const event = createVPCLatticeV2Event();
      const response = { statusCode: 200, body: '{"ok":true}', headers: { 'x-custom': 'value' } };

      const result = vpcLatticeV2Adapter.buildResult(response, event);

      expect(result).toEqual({
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
      });
    });
  });
});

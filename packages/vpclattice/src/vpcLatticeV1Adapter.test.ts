import { createVPCLatticeV1Event } from '@lambda-event-router/testing';
import { vpcLatticeV1Adapter } from './vpcLatticeV1Adapter.js';

suite('vpcLatticeV1Adapter', () => {
  suite('canHandleEvent', () => {
    test('returns true for a valid V1 event', () => {
      const event = createVPCLatticeV1Event();
      expect(vpcLatticeV1Adapter.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(vpcLatticeV1Adapter.canHandleEvent(null)).toBe(false);
    });

    test('returns false when raw_path is missing', () => {
      expect(vpcLatticeV1Adapter.canHandleEvent({ method: 'GET' })).toBe(false);
    });

    test('returns false when method is missing', () => {
      expect(vpcLatticeV1Adapter.canHandleEvent({ raw_path: '/' })).toBe(false);
    });

    test('returns false when version is 2.0', () => {
      expect(vpcLatticeV1Adapter.canHandleEvent({ method: 'GET', raw_path: '/', version: '2.0' })).toBe(false);
    });

    test('returns false when requestContext is present', () => {
      expect(vpcLatticeV1Adapter.canHandleEvent({ method: 'GET', raw_path: '/', requestContext: {} })).toBe(false);
    });
  });

  suite('normalize', () => {
    test('extracts method, path, body from V1 event', () => {
      const event = createVPCLatticeV1Event({
        method: 'POST',
        raw_path: '/items',
        body: '{"name":"test"}',
      });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.method).toBe('POST');
      expect(normalized.path).toBe('/items');
      expect(normalized.body).toBe('{"name":"test"}');
    });

    test('flattens headers to lowercase', () => {
      const event = createVPCLatticeV1Event({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.headers['content-type']).toBe('application/json');
      expect(normalized.headers.authorization).toBe('Bearer token');
    });

    test('returns empty headers when headers is undefined', () => {
      const event = createVPCLatticeV1Event({ headers: undefined });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.headers).toEqual({});
    });

    test('returns empty query when query_string_parameters is undefined', () => {
      const event = createVPCLatticeV1Event();

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.query).toEqual({});
    });

    test('passes through query string parameters', () => {
      const event = createVPCLatticeV1Event({
        query_string_parameters: { page: '1', limit: '10' },
      });

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.query).toEqual({ page: '1', limit: '10' });
    });

    test('returns undefined body when event body is undefined', () => {
      const event = createVPCLatticeV1Event();

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.body).toBeUndefined();
    });

    test('passes through is_base64_encoded as isBase64Encoded', () => {
      const event = createVPCLatticeV1Event({ is_base64_encoded: true });
      const normalized = vpcLatticeV1Adapter.normalize(event);
      expect(normalized.isBase64Encoded).toBe(true);
    });

    test('auth is always undefined for V1', () => {
      const event = createVPCLatticeV1Event();

      const normalized = vpcLatticeV1Adapter.normalize(event);

      expect(normalized.auth).toBeUndefined();
    });
  });

  suite('buildResult', () => {
    test('converts finalized response to VPC Lattice result', () => {
      const event = createVPCLatticeV1Event();
      const response = { statusCode: 200, body: '{"ok":true}', headers: { 'x-custom': 'value' } };

      const result = vpcLatticeV1Adapter.buildResult(response, event);

      expect(result).toEqual({
        statusCode: 200,
        body: '{"ok":true}',
        headers: { 'x-custom': 'value' },
      });
    });
  });
});

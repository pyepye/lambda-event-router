import { createVPCLatticeV1Event, createVPCLatticeV2Event } from '@lambda-event-router/testing';

import { vpcLatticeAdapter } from './vpcLatticeAdapter.js';

suite('vpcLatticeAdapter', () => {
  suite('canHandleEvent', () => {
    test('returns true for a V1 event', () => {
      const event = createVPCLatticeV1Event();
      expect(vpcLatticeAdapter.canHandleEvent(event)).toBe(true);
    });

    test('returns true for a V2 event', () => {
      const event = createVPCLatticeV2Event();
      expect(vpcLatticeAdapter.canHandleEvent(event)).toBe(true);
    });

    test('returns false for null', () => {
      expect(vpcLatticeAdapter.canHandleEvent(null)).toBe(false);
    });

    test('returns false for an unrelated event', () => {
      expect(vpcLatticeAdapter.canHandleEvent({ Records: [] })).toBe(false);
    });
  });

  suite('normalize', () => {
    test('delegates to V2 adapter for V2 events', () => {
      const event = createVPCLatticeV2Event({
        path: '/v2-path',
        method: 'GET',
      });

      const normalized = vpcLatticeAdapter.normalize(event);

      expect(normalized.path).toBe('/v2-path');
      expect(normalized.method).toBe('GET');
    });

    test('delegates to V1 adapter for V1 events', () => {
      const event = createVPCLatticeV1Event({
        raw_path: '/v1-path',
        method: 'POST',
      });

      const normalized = vpcLatticeAdapter.normalize(event);

      expect(normalized.path).toBe('/v1-path');
      expect(normalized.method).toBe('POST');
    });
  });

  suite('buildResult', () => {
    test('delegates to V2 adapter for V2 events', () => {
      const event = createVPCLatticeV2Event();
      const response = { statusCode: 200, body: 'ok' };

      const result = vpcLatticeAdapter.buildResult(response, event);

      expect(result).toEqual({ statusCode: 200, body: 'ok', headers: undefined });
    });

    test('delegates to V1 adapter for V1 events', () => {
      const event = createVPCLatticeV1Event();
      const response = { statusCode: 200, body: 'ok' };

      const result = vpcLatticeAdapter.buildResult(response, event);

      expect(result).toEqual({ statusCode: 200, body: 'ok', headers: undefined });
    });
  });
});

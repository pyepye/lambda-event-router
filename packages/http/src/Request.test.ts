import type { MockInstance } from 'vitest';

import * as base from '@lambda-event-router/base';
import { createMockContext, createMockSchema } from '@lambda-event-router/testing';

import type { InternalRoute } from './PathRouter.js';
import { Request } from './Request.js';
import { Response } from './Response.js';
import type { NormalizedHTTPEvent } from './types.js';

const safeJsonParseSpy: MockInstance = vi.spyOn(base, 'safeJsonParse');
const validateSchemaResultSpy: MockInstance = vi.spyOn(base, 'validateSchemaResult');

function createRoute(overrides: Partial<InternalRoute> = {}): InternalRoute {
  return {
    method: 'GET',
    path: '/',
    pattern: /^\/$/,
    pathParamNames: [],
    pathParamMask: [],
    matchShape: 'GET /',
    handler: vi.fn(),
    middleware: [],
    ...overrides,
  };
}

function createNormalizedEvent(overrides: Partial<NormalizedHTTPEvent> = {}): NormalizedHTTPEvent {
  // TODO: Should support body stringify etc
  return {
    method: 'GET',
    path: '/',
    headers: {},
    query: {},
    body: undefined,
    isBase64Encoded: false,
    auth: undefined,
    ...overrides,
  };
}

suite('Request', () => {
  suite('constructor', () => {
    test('sets headers, method, and path from the normalized event', () => {
      const normalizedEvent = createNormalizedEvent({
        headers: { 'content-type': 'application/json' },
        path: '/items',
        method: 'POST',
      });

      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      expect(request.headers).toEqual({ 'content-type': 'application/json' });
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/items');
    });
  });

  suite('body', () => {
    test('parses a JSON body', () => {
      const body = JSON.stringify({ name: 'test' });
      const normalizedEvent = createNormalizedEvent({ body }); // TODO: Fixture should stringify
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      expect(request.body).toEqual({ name: 'test' });
      expect(safeJsonParseSpy).toHaveBeenCalledWith(body);
    });

    test('returns null when body is absent', () => {
      const normalizedEvent = createNormalizedEvent();
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      expect(request.body).toBeNull();
    });

    test('returns a plain string when body is not valid JSON', () => {
      const normalizedEvent = createNormalizedEvent({ body: 'plain text' });
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      expect(request.body).toBe('plain text');
    });

    test('decodes a base64-encoded JSON body', () => {
      const encoded = Buffer.from(JSON.stringify({ id: 1 })).toString('base64');
      const normalizedEvent = createNormalizedEvent({ body: encoded, isBase64Encoded: true });
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      expect(request.body).toEqual({ id: 1 });
    });

    test('returns decoded string for base64 non-JSON body', () => {
      const encoded = Buffer.from('plain text').toString('base64');
      const normalizedEvent = createNormalizedEvent({ body: encoded, isBase64Encoded: true });
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      expect(request.body).toBe('plain text');
    });

    test('caches the parsed body on subsequent accesses', () => {
      const normalizedEvent = createNormalizedEvent({ body: JSON.stringify({ count: 42 }) });
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      const firstAccess = request.body;
      const secondAccess = request.body;

      expect(firstAccess).toBe(secondAccess);
    });
  });

  suite('auth', () => {
    test('returns auth from the normalized event', () => {
      const auth = { claims: { sub: 'user-1' } };
      const normalizedEvent = createNormalizedEvent({ auth });
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      expect(request.auth).toEqual(auth);
    });

    test('returns undefined when no auth is present', () => {
      const normalizedEvent = createNormalizedEvent();
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      expect(request.auth).toBeUndefined();
    });
  });

  suite('queryParams', () => {
    test('returns query parameters from the normalized event', () => {
      const normalizedEvent = createNormalizedEvent({ query: { page: '1', limit: '10' } });
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      expect(request.queryParams).toEqual({ page: '1', limit: '10' });
    });

    test('returns an empty object when no query parameters exist', () => {
      const normalizedEvent = createNormalizedEvent();
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      expect(request.queryParams).toEqual({});
    });
  });

  suite('validateQuery', () => {
    test('returns the raw query when no querySchema is defined', async () => {
      const normalizedEvent = createNormalizedEvent({ query: { page: '2' } });
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      await expect(request.validateQuery()).resolves.toEqual({ page: '2' });
    });

    test('returns the schema output so coercion and defaults reach the caller', async () => {
      const querySchema = createMockSchema({ value: { page: 2, dryRun: false } });
      const route = createRoute({ querySchema });
      const normalizedEvent = createNormalizedEvent({ query: { page: '2' } });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, {});

      await expect(request.validateQuery()).resolves.toEqual({ page: 2, dryRun: false });
      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ page: '2' }, querySchema);
    });

    test('throws a BadRequest response when query validation fails', async () => {
      const querySchema = createMockSchema({ issues: [{ message: 'invalid query' }] });
      const route = createRoute({ querySchema });
      const normalizedEvent = createNormalizedEvent({ query: { bad: 'param' } });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, {});

      try {
        await request.validateQuery();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(400);
      }
      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ bad: 'param' }, querySchema);
    });
  });

  suite('validateBody', () => {
    test('returns the parsed body when no bodySchema is defined', async () => {
      const normalizedEvent = createNormalizedEvent({ body: JSON.stringify({ total: '42' }) });
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      await expect(request.validateBody()).resolves.toEqual({ total: '42' });
    });

    test('returns the schema output so coercion and defaults reach the caller', async () => {
      const bodySchema = createMockSchema({ value: { total: 42, currency: 'GBP' } });
      const route = createRoute({ bodySchema });
      const normalizedEvent = createNormalizedEvent({ body: JSON.stringify({ total: '42' }) });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, {});

      await expect(request.validateBody()).resolves.toEqual({ total: 42, currency: 'GBP' });
      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ total: '42' }, bodySchema);
    });

    test('throws an UnprocessableContent response when body validation fails', async () => {
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });
      const route = createRoute({ bodySchema });
      const normalizedEvent = createNormalizedEvent({ body: JSON.stringify({ invalid: true }) });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, {});

      try {
        await request.validateBody();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(422);
      }
      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ invalid: true }, bodySchema);
    });

    test('throws UnprocessableContent when body is a string and bodySchema rejects it', async () => {
      const bodySchema = createMockSchema({ issues: [{ message: 'expected object, received string' }] });
      const route = createRoute({ bodySchema });
      const normalizedEvent = createNormalizedEvent({ body: 'not valid json' });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, {});

      try {
        await request.validateBody();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(422);
      }
      expect(bodySchema['~standard'].validate).toHaveBeenCalled();
    });
  });

  suite('buildApiRequest', () => {
    test('returns an ApiRequest with all properties', () => {
      const rawEvent = { original: 'event' };
      const normalizedEvent = createNormalizedEvent({
        path: '/items/42',
        method: 'GET',
        headers: { authorization: 'Bearer token' },
      });
      const mockContext = createMockContext();
      const pathParams = { id: '42' };
      const request = new Request(normalizedEvent, rawEvent, mockContext, createRoute(), pathParams);

      const apiRequest = request.buildApiRequest({ expand: 'true' }, undefined);

      expect(apiRequest.path).toEqual({ id: '42' });
      expect(apiRequest.query).toEqual({ expand: 'true' });
      expect(apiRequest.headers).toEqual({ authorization: 'Bearer token' });
      expect(apiRequest.event).toBe(rawEvent);
      expect(apiRequest.context).toBe(mockContext);
    });

    test('carries the query and body it is handed rather than the raw request values', () => {
      const normalizedEvent = createNormalizedEvent({
        query: { page: '2' },
        body: JSON.stringify({ total: '42' }),
      });
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      const apiRequest = request.buildApiRequest({ page: 2 } as never, { total: 42 });

      expect(apiRequest.query).toEqual({ page: 2 });
      expect(apiRequest.body).toEqual({ total: 42 });
    });
  });
});

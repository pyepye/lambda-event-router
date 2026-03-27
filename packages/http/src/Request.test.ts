import * as base from '@lambda-event-router/base';
import { createMockContext, createMockSchema } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
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
    paramNames: [],
    handler: vi.fn(),
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

  suite('validate', () => {
    test('does not throw when no schemas are defined', async () => {
      const request = new Request(createNormalizedEvent(), {}, createMockContext(), createRoute(), {});

      await expect(request.validate()).resolves.toBeUndefined();
    });

    test('throws a NotFound response when path validation fails', async () => {
      const pathSchema = createMockSchema({ issues: [{ message: 'invalid path' }] });
      const route = createRoute({ pathSchema });
      const request = new Request(createNormalizedEvent(), {}, createMockContext(), route, { id: 'bad' });

      try {
        await request.validate();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(404);
      }
      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ id: 'bad' }, pathSchema);
    });

    test('throws a BadRequest response when query validation fails', async () => {
      const querySchema = createMockSchema({ issues: [{ message: 'invalid query' }] });
      const route = createRoute({ querySchema });
      const normalizedEvent = createNormalizedEvent({ query: { bad: 'param' } });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, {});

      try {
        await request.validate();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(400);
      }
      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ bad: 'param' }, querySchema);
    });

    test('throws an UnprocessableContent response when body validation fails', async () => {
      const bodySchema = createMockSchema({ issues: [{ message: 'invalid body' }] });
      const route = createRoute({ bodySchema });
      const normalizedEvent = createNormalizedEvent({ body: JSON.stringify({ invalid: true }) });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, {});

      try {
        await request.validate();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(422);
      }
      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ invalid: true }, bodySchema);
    });

    test('does not throw when all schemas pass', async () => {
      const pathSchema = createMockSchema();
      const querySchema = createMockSchema();
      const bodySchema = createMockSchema();
      const route = createRoute({ pathSchema, querySchema, bodySchema });
      const normalizedEvent = createNormalizedEvent({
        body: JSON.stringify({ name: 'test' }),
        query: { page: '1' },
      });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, { id: '1' });

      await expect(request.validate()).resolves.toBeUndefined();
      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ id: '1' }, pathSchema);
      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ page: '1' }, querySchema);
      expect(validateSchemaResultSpy).toHaveBeenCalledWith({ name: 'test' }, bodySchema);
    });

    test('throws UnprocessableContent when body is a string and bodySchema rejects it', async () => {
      const bodySchema = createMockSchema({ issues: [{ message: 'expected object, received string' }] });
      const route = createRoute({ bodySchema });
      const normalizedEvent = createNormalizedEvent({ body: 'not valid json' });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, {});

      try {
        await request.validate();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(422);
      }
      expect(bodySchema['~standard'].validate).toHaveBeenCalled();
    });

    test('short-circuits on path failure without calling query or body schemas', async () => {
      const pathSchema = createMockSchema({ issues: [{ message: 'invalid path' }] });
      const querySchema = createMockSchema();
      const bodySchema = createMockSchema();
      const route = createRoute({ pathSchema, querySchema, bodySchema });
      const normalizedEvent = createNormalizedEvent({
        body: JSON.stringify({ name: 'test' }),
        query: { page: '1' },
      });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, { id: 'bad' });

      try {
        await request.validate();
        expect.unreachable('should have thrown');
      } catch {
        // expected
      }

      expect(querySchema['~standard'].validate).not.toHaveBeenCalled();
      expect(bodySchema['~standard'].validate).not.toHaveBeenCalled();
    });

    test('short-circuits on query failure without calling body schema', async () => {
      const pathSchema = createMockSchema();
      const querySchema = createMockSchema({ issues: [{ message: 'invalid query' }] });
      const bodySchema = createMockSchema();
      const route = createRoute({ pathSchema, querySchema, bodySchema });
      const normalizedEvent = createNormalizedEvent({
        body: JSON.stringify({ name: 'test' }),
        query: { bad: 'param' },
      });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, { id: '1' });

      try {
        await request.validate();
        expect.unreachable('should have thrown');
      } catch {
        // expected
      }

      expect(bodySchema['~standard'].validate).not.toHaveBeenCalled();
    });
  });

  suite('buildApiRequest', () => {
    test('returns an ApiRequest with all properties', () => {
      const rawEvent = { original: 'event' };
      const normalizedEvent = createNormalizedEvent({
        path: '/items/42',
        method: 'GET',
        headers: { authorization: 'Bearer token' },
        query: { expand: 'true' },
      });
      const mockContext = createMockContext();
      const pathParams = { id: '42' };
      const request = new Request(normalizedEvent, rawEvent, mockContext, createRoute(), pathParams);

      const apiRequest = request.buildApiRequest();

      expect(apiRequest.path).toEqual({ id: '42' });
      expect(apiRequest.query).toEqual({ expand: 'true' });
      expect(apiRequest.headers).toEqual({ authorization: 'Bearer token' });
      expect(apiRequest.event).toBe(rawEvent);
      expect(apiRequest.context).toBe(mockContext);
    });

    test('includes the parsed body in the request', () => {
      const normalizedEvent = createNormalizedEvent({ body: JSON.stringify({ name: 'test' }) });
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      const apiRequest = request.buildApiRequest();

      expect(apiRequest.body).toEqual({ name: 'test' });
    });
  });
});

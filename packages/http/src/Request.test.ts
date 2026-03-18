import { createMockContext } from '@lambda-event-router/testing';
import type { InternalRoute } from './PathRouter.js';
import { Request } from './Request.js';
import { Response } from './Response.js';
import type { NormalizedHTTPEvent } from './types.js';

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
      const context = createMockContext();
      const route = createRoute();

      const request = new Request(normalizedEvent, {}, context, route, {});

      expect(request.headers).toEqual({ 'content-type': 'application/json' });
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/items');
    });
  });

  suite('body', () => {
    test('parses a JSON body', () => {
      const normalizedEvent = createNormalizedEvent({ body: JSON.stringify({ name: 'test' }) });
      const request = new Request(normalizedEvent, {}, createMockContext(), createRoute(), {});

      expect(request.body).toEqual({ name: 'test' });
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

  suite('validateWithSchema', () => {
    test('returns success with original data when no schema is provided', () => {
      const request = new Request(createNormalizedEvent(), {}, createMockContext(), createRoute(), {});
      const originalData = { id: '1' };

      // @ts-expect-error - testing private method directly
      const result = request.validateWithSchema(undefined, originalData);

      expect(result).toEqual({ success: true, data: originalData });
    });

    test('returns success with transformed data when schema passes', () => {
      const transformedData = { id: 1 };
      const schema = { safeParse: vi.fn().mockReturnValue({ success: true, data: transformedData }) };
      const request = new Request(createNormalizedEvent(), {}, createMockContext(), createRoute(), {});

      // @ts-expect-error - testing private method directly
      const result = request.validateWithSchema(schema, { id: '1' });

      expect(result).toEqual({ success: true, data: transformedData });
    });

    test('returns failure with error when schema fails', () => {
      const schemaError = { message: 'invalid' };
      const schema = { safeParse: vi.fn().mockReturnValue({ success: false, error: schemaError }) };
      const request = new Request(createNormalizedEvent(), {}, createMockContext(), createRoute(), {});

      // @ts-expect-error - testing private method directly
      const result = request.validateWithSchema(schema, { bad: 'data' });

      expect(result).toEqual({ success: false, error: schemaError });
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
    test('does not throw when no schemas are defined', () => {
      const request = new Request(createNormalizedEvent(), {}, createMockContext(), createRoute(), {});

      expect(() => request.validate()).not.toThrow();
    });

    test('throws a NotFound response when path validation fails', () => {
      const pathSchema = {
        safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid path' }),
      };
      const route = createRoute({ pathSchema });
      const request = new Request(createNormalizedEvent(), {}, createMockContext(), route, { id: 'bad' });

      try {
        request.validate();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(404);
      }
    });

    test('throws a BadRequest response when query validation fails', () => {
      const querySchema = {
        safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid query' }),
      };
      const route = createRoute({ querySchema });
      const normalizedEvent = createNormalizedEvent({ query: { bad: 'param' } });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, {});

      try {
        request.validate();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(400);
      }
    });

    test('throws an UnprocessableContent response when body validation fails', () => {
      const bodySchema = {
        safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid body' }),
      };
      const route = createRoute({ bodySchema });
      const normalizedEvent = createNormalizedEvent({ body: JSON.stringify({ invalid: true }) });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, {});

      try {
        request.validate();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(422);
      }
    });

    test('does not throw when all schemas pass', () => {
      const pathSchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: { id: '1' } }) };
      const querySchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: { page: '1' } }) };
      const bodySchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: { name: 'test' } }) };
      const route = createRoute({ pathSchema, querySchema, bodySchema });
      const normalizedEvent = createNormalizedEvent({
        body: JSON.stringify({ name: 'test' }),
        query: { page: '1' },
      });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, { id: '1' });

      expect(() => request.validate()).not.toThrow();
    });

    test('throws UnprocessableContent when body is a string and bodySchema is provided', () => {
      const bodySchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) };
      const route = createRoute({ bodySchema });
      const normalizedEvent = createNormalizedEvent({ body: 'not valid json' });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, {});

      try {
        request.validate();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(422);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.body).toBe('Failed to parse JSON body');
      }
      expect(bodySchema.safeParse).not.toHaveBeenCalled();
    });

    test('short-circuits on path failure without calling query or body schemas', () => {
      const pathSchema = { safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid path' }) };
      const querySchema = { safeParse: vi.fn() };
      const bodySchema = { safeParse: vi.fn() };
      const route = createRoute({ pathSchema, querySchema, bodySchema });
      const normalizedEvent = createNormalizedEvent({
        body: JSON.stringify({ name: 'test' }),
        query: { page: '1' },
      });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, { id: 'bad' });

      try {
        request.validate();
      } catch {
        // expected
      }

      expect(querySchema.safeParse).not.toHaveBeenCalled();
      expect(bodySchema.safeParse).not.toHaveBeenCalled();
    });

    test('short-circuits on query failure without calling body schema', () => {
      const pathSchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: { id: '1' } }) };
      const querySchema = { safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid query' }) };
      const bodySchema = { safeParse: vi.fn() };
      const route = createRoute({ pathSchema, querySchema, bodySchema });
      const normalizedEvent = createNormalizedEvent({
        body: JSON.stringify({ name: 'test' }),
        query: { bad: 'param' },
      });
      const request = new Request(normalizedEvent, {}, createMockContext(), route, { id: '1' });

      try {
        request.validate();
      } catch {
        // expected
      }

      expect(bodySchema.safeParse).not.toHaveBeenCalled();
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

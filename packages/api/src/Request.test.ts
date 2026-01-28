import { test } from '@lambda-event-router/testing';
import type { InternalRoute } from './PathRouter.js';
import { Request } from './Request.js';
import { Response } from './Response.js';

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

suite('Request', () => {
  suite('constructor', () => {
    test('sets headers, method, and path from the event', ({ apiEvent, context }) => {
      const event = apiEvent({
        headers: { 'content-type': 'application/json' },
        rawPath: '/items',
        requestContext: { http: { method: 'POST' } },
      });
      const mockContext = context();
      const route = createRoute();

      const request = new Request(event, mockContext, route, {});

      expect(request.headers).toEqual({ 'content-type': 'application/json' });
      expect(request.method).toBe('POST');
      expect(request.path).toBe('/items');
    });
  });

  suite('body', () => {
    test('parses a JSON body', ({ apiEvent, context }) => {
      const event = apiEvent({ body: { name: 'test' } });
      const request = new Request(event, context(), createRoute(), {});

      expect(request.body).toEqual({ name: 'test' });
    });

    test('returns null when body is absent', ({ apiEvent, context }) => {
      const event = apiEvent();
      const request = new Request(event, context(), createRoute(), {});

      expect(request.body).toBeNull();
    });

    test('returns a plain string when body is not valid JSON', ({ apiEvent, context }) => {
      const event = apiEvent({ body: 'plain text' });
      const request = new Request(event, context(), createRoute(), {});

      expect(request.body).toBe('plain text');
    });

    test('decodes a base64-encoded JSON body', ({ apiEvent, context }) => {
      const encoded = Buffer.from(JSON.stringify({ id: 1 })).toString('base64');
      const event = apiEvent({ body: encoded, isBase64Encoded: true });
      const request = new Request(event, context(), createRoute(), {});

      expect(request.body).toEqual({ id: 1 });
    });

    test('returns decoded string for base64 non-JSON body', ({ apiEvent, context }) => {
      const encoded = Buffer.from('plain text').toString('base64');
      const event = apiEvent({ body: encoded, isBase64Encoded: true });
      const request = new Request(event, context(), createRoute(), {});

      expect(request.body).toBe('plain text');
    });

    test('caches the parsed body on subsequent accesses', ({ apiEvent, context }) => {
      const event = apiEvent({ body: { count: 42 } });
      const request = new Request(event, context(), createRoute(), {});

      const firstAccess = request.body;
      const secondAccess = request.body;

      expect(firstAccess).toBe(secondAccess);
    });
  });

  suite('validateWithSchema', () => {
    test('returns success with original data when no schema is provided', ({ apiEvent, context }) => {
      const request = new Request(apiEvent(), context(), createRoute(), {});
      const originalData = { id: '1' };

      // @ts-expect-error - testing private method directly
      const result = request.validateWithSchema(undefined, originalData);

      expect(result).toEqual({ success: true, data: originalData });
    });

    test('returns success with transformed data when schema passes', ({ apiEvent, context }) => {
      const transformedData = { id: 1 };
      const schema = { safeParse: vi.fn().mockReturnValue({ success: true, data: transformedData }) };
      const request = new Request(apiEvent(), context(), createRoute(), {});

      // @ts-expect-error - testing private method directly
      const result = request.validateWithSchema(schema, { id: '1' });

      expect(result).toEqual({ success: true, data: transformedData });
    });

    test('returns failure with error when schema fails', ({ apiEvent, context }) => {
      const schemaError = { message: 'invalid' };
      const schema = { safeParse: vi.fn().mockReturnValue({ success: false, error: schemaError }) };
      const request = new Request(apiEvent(), context(), createRoute(), {});

      // @ts-expect-error - testing private method directly
      const result = request.validateWithSchema(schema, { bad: 'data' });

      expect(result).toEqual({ success: false, error: schemaError });
    });
  });

  suite('queryParams', () => {
    test('returns query string parameters from the event', ({ apiEvent, context }) => {
      const event = apiEvent({ queryStringParameters: { page: '1', limit: '10' } });
      const request = new Request(event, context(), createRoute(), {});

      expect(request.queryParams).toEqual({ page: '1', limit: '10' });
    });

    test('returns an empty object when no query parameters exist', ({ apiEvent, context }) => {
      const event = apiEvent();
      const request = new Request(event, context(), createRoute(), {});

      expect(request.queryParams).toEqual({});
    });
  });

  suite('validate', () => {
    test('does not throw when no schemas are defined', ({ apiEvent, context }) => {
      const event = apiEvent();
      const request = new Request(event, context(), createRoute(), {});

      expect(() => request.validate()).not.toThrow();
    });

    test('throws a NotFound response when path validation fails', ({ apiEvent, context }) => {
      const pathSchema = {
        safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid path' }),
      };
      const route = createRoute({ pathSchema });
      const request = new Request(apiEvent(), context(), route, { id: 'bad' });

      try {
        request.validate();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(404);
      }
    });

    test('throws a BadRequest response when query validation fails', ({ apiEvent, context }) => {
      const querySchema = {
        safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid query' }),
      };
      const route = createRoute({ querySchema });
      const event = apiEvent({ queryStringParameters: { bad: 'param' } });
      const request = new Request(event, context(), route, {});

      try {
        request.validate();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(400);
      }
    });

    test('throws an UnprocessableContent response when body validation fails', ({ apiEvent, context }) => {
      const bodySchema = {
        safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid body' }),
      };
      const route = createRoute({ bodySchema });
      const event = apiEvent({ body: { invalid: true } });
      const request = new Request(event, context(), route, {});

      try {
        request.validate();
        expect.unreachable('should have thrown');
      } catch (thrown) {
        expect(Response.isHTTPResponse(thrown)).toBe(true);
        // @ts-expect-error - thrown is unknown but we verified it's an HTTPResponse above
        expect(thrown.statusCode).toBe(422);
      }
    });

    test('does not throw when all schemas pass', ({ apiEvent, context }) => {
      const pathSchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: { id: '1' } }) };
      const querySchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: { page: '1' } }) };
      const bodySchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: { name: 'test' } }) };
      const route = createRoute({ pathSchema, querySchema, bodySchema });
      const event = apiEvent({ body: { name: 'test' }, queryStringParameters: { page: '1' } });
      const request = new Request(event, context(), route, { id: '1' });

      expect(() => request.validate()).not.toThrow();
    });

    test('short-circuits on path failure without calling query or body schemas', ({ apiEvent, context }) => {
      const pathSchema = { safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid path' }) };
      const querySchema = { safeParse: vi.fn() };
      const bodySchema = { safeParse: vi.fn() };
      const route = createRoute({ pathSchema, querySchema, bodySchema });
      const event = apiEvent({ body: { name: 'test' }, queryStringParameters: { page: '1' } });
      const request = new Request(event, context(), route, { id: 'bad' });

      try {
        request.validate();
      } catch {
        // expected
      }

      expect(querySchema.safeParse).not.toHaveBeenCalled();
      expect(bodySchema.safeParse).not.toHaveBeenCalled();
    });

    test('short-circuits on query failure without calling body schema', ({ apiEvent, context }) => {
      const pathSchema = { safeParse: vi.fn().mockReturnValue({ success: true, data: { id: '1' } }) };
      const querySchema = { safeParse: vi.fn().mockReturnValue({ success: false, error: 'invalid query' }) };
      const bodySchema = { safeParse: vi.fn() };
      const route = createRoute({ pathSchema, querySchema, bodySchema });
      const event = apiEvent({ body: { name: 'test' }, queryStringParameters: { bad: 'param' } });
      const request = new Request(event, context(), route, { id: '1' });

      try {
        request.validate();
      } catch {
        // expected
      }

      expect(bodySchema.safeParse).not.toHaveBeenCalled();
    });
  });

  suite('buildApiRequest', () => {
    test('returns an ApiRequest with all properties', ({ apiEvent, context }) => {
      const event = apiEvent({
        rawPath: '/items/42',
        requestContext: { http: { method: 'GET', path: '/items/42' } },
        headers: { authorization: 'Bearer token' },
        queryStringParameters: { expand: 'true' },
      });
      const mockContext = context();
      const pathParams = { id: '42' };
      const request = new Request(event, mockContext, createRoute(), pathParams);

      const apiRequest = request.buildApiRequest();

      expect(apiRequest.path).toEqual({ id: '42' });
      expect(apiRequest.query).toEqual({ expand: 'true' });
      expect(apiRequest.headers).toEqual({ authorization: 'Bearer token' });
      expect(apiRequest.event).toBe(event);
      expect(apiRequest.context).toBe(mockContext);
    });

    test('includes the parsed body in the request', ({ apiEvent, context }) => {
      const event = apiEvent({ body: { name: 'test' } });
      const request = new Request(event, context(), createRoute(), {});

      const apiRequest = request.buildApiRequest();

      expect(apiRequest.body).toEqual({ name: 'test' });
    });
  });
});

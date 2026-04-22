import {
  createApiGatewayLambdaAuthorizerRequestV1Event,
  createApiGatewayLambdaAuthorizerRequestV2Event,
  createApiGatewayLambdaAuthorizerTokenEvent,
  test,
} from '@lambda-event-router/testing';

import {
  createLambdaAuthorizerRouter,
  defineLambdaAuthorizerRoute,
  generatePolicy,
  LambdaAuthorizerRouter,
} from './LambdaAuthorizerRouter.js';
import type { LambdaAuthorizerFilterInput } from './types.js';

suite('LambdaAuthorizerRouter', () => {
  let router: LambdaAuthorizerRouter;

  beforeEach(() => {
    router = new LambdaAuthorizerRouter();
  });

  suite('createLambdaAuthorizerRouter', () => {
    test('creates a LambdaAuthorizerRouter instance', () => {
      const router = createLambdaAuthorizerRouter();
      expect(router).toBeInstanceOf(LambdaAuthorizerRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid TOKEN event', () => {
      const event = createApiGatewayLambdaAuthorizerTokenEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for a valid REQUEST V1 event', () => {
      const event = createApiGatewayLambdaAuthorizerRequestV1Event();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for a valid REQUEST V2 event', () => {
      const event = createApiGatewayLambdaAuthorizerRequestV2Event();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test.each([null, 'not an event', 42, [1, 2, 3]])('returns false for non-object value: %j', (value) => {
      expect(router.canHandleEvent(value)).toBe(false);
    });

    test('returns false when type is missing', () => {
      expect(router.canHandleEvent({ authorizationToken: 'Bearer x', methodArn: 'arn:...' })).toBe(false);
    });

    test('returns false when type is not TOKEN or REQUEST', () => {
      expect(router.canHandleEvent({ type: 'CUSTOM', authorizationToken: 'Bearer x', methodArn: 'arn:...' })).toBe(
        false,
      );
    });

    test('returns false for TOKEN when authorizationToken is missing', () => {
      expect(router.canHandleEvent({ type: 'TOKEN', methodArn: 'arn:...' })).toBe(false);
    });

    test('returns false for TOKEN when methodArn is missing', () => {
      expect(router.canHandleEvent({ type: 'TOKEN', authorizationToken: 'Bearer x' })).toBe(false);
    });

    test('returns false for TOKEN when authorizationToken is not a string', () => {
      expect(router.canHandleEvent({ type: 'TOKEN', authorizationToken: 123, methodArn: 'arn:...' })).toBe(false);
    });

    test('returns false for REQUEST when neither methodArn nor routeArn is present', () => {
      expect(router.canHandleEvent({ type: 'REQUEST' })).toBe(false);
    });

    test('returns false for REQUEST V1 when httpMethod is missing', () => {
      expect(router.canHandleEvent({ type: 'REQUEST', methodArn: 'arn:...' })).toBe(false);
    });
  });

  suite('route (chaining)', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineLambdaAuthorizerRoute({
        filters: { type: 'TOKEN' },
      }).handle(async () => generatePolicy('user', 'Allow', 'arn:...'));

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('token / request (chaining)', () => {
    test('token() returns the router instance for chaining', () => {
      const result = router.token({ handler: async () => generatePolicy('user', 'Allow', 'arn:...') });
      expect(result).toBe(router);
    });

    test('request() returns the router instance for chaining', () => {
      const result = router.request({ handler: async () => generatePolicy('user', 'Allow', 'arn:...') });
      expect(result).toBe(router);
    });

    test('request() with method returns the router instance for chaining', () => {
      const result = router.request({
        method: 'GET',
        handler: async () => generatePolicy('user', 'Allow', 'arn:...'),
      });
      expect(result).toBe(router);
    });
  });

  suite('defineLambdaAuthorizerRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineLambdaAuthorizerRoute({
        filters: { type: 'TOKEN' },
      });

      expect(builder).toHaveProperty('handle');
      expect(builder.handle).toBeTypeOf('function');
    });

    test('preserves filters and handler in the definition', () => {
      const handler = vi.fn();

      const definition = defineLambdaAuthorizerRoute({
        filters: { type: 'REQUEST', method: 'POST' },
      }).handle(handler);

      expect(definition.filters).toEqual({ type: 'REQUEST', method: 'POST' });
      expect(definition.handler).toBe(handler);
    });
  });

  suite('generatePolicy', () => {
    test('generates Allow policy with correct structure', () => {
      const result = generatePolicy('user-123', 'Allow', 'arn:aws:execute-api:us-east-1:123456789012:abc123/*');

      expect(result).toEqual({
        principalId: 'user-123',
        policyDocument: {
          Version: '2012-10-17',
          Statement: [
            {
              Action: 'execute-api:Invoke',
              Effect: 'Allow',
              Resource: 'arn:aws:execute-api:us-east-1:123456789012:abc123/*',
            },
          ],
        },
      });
    });

    test('generates Deny policy with correct structure', () => {
      const result = generatePolicy('user-456', 'Deny', 'arn:aws:execute-api:us-east-1:123456789012:abc123/*');

      expect(result.principalId).toBe('user-456');
      expect(result.policyDocument.Statement[0]).toEqual(expect.objectContaining({ Effect: 'Deny' }));
    });

    test('uses provided principalId and resource', () => {
      const resource = 'arn:aws:execute-api:eu-west-1:999999999999:xyz789/prod/GET/items';
      const result = generatePolicy('custom-principal', 'Allow', resource);

      expect(result.principalId).toBe('custom-principal');
      expect(result.policyDocument.Statement[0]).toEqual(expect.objectContaining({ Resource: resource }));
    });
  });

  suite('handleEvent', () => {
    test('calls matched TOKEN handler and returns policy result', async ({
      apiGatewayLambdaAuthorizerTokenHandlerEvent,
    }) => {
      const policy = generatePolicy('user', 'Allow', 'arn:...');
      const handler = vi.fn().mockResolvedValue(policy);
      router.token({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerTokenHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toEqual(policy);
    });

    test('passes authorizationToken, type, resourceArn to TOKEN handler', async ({
      apiGatewayLambdaAuthorizerTokenHandlerEvent,
    }) => {
      const handler = vi.fn().mockResolvedValue(generatePolicy('user', 'Allow', 'arn:...'));
      router.token({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerTokenHandlerEvent({
        event: {
          authorizationToken: 'Bearer my-secret-token',
          methodArn: 'arn:aws:execute-api:us-east-1:123:abc/prod/GET/items',
        },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          authorizationToken: 'Bearer my-secret-token',
          type: 'TOKEN',
          resourceArn: 'arn:aws:execute-api:us-east-1:123:abc/prod/GET/items',
        }),
      );
    });

    test('passes event and context on the TOKEN request object', async ({
      apiGatewayLambdaAuthorizerTokenHandlerEvent,
    }) => {
      const handler = vi.fn().mockResolvedValue(generatePolicy('user', 'Allow', 'arn:...'));
      router.token({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerTokenHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ event, context }));
    });

    test('calls matched REQUEST handler for V1 event', async ({ apiGatewayLambdaAuthorizerRequestV1HandlerEvent }) => {
      const policy = generatePolicy('user', 'Allow', 'arn:...');
      const handler = vi.fn().mockResolvedValue(policy);
      router.request({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerRequestV1HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toEqual(policy);
    });

    test('passes method, path, headers (lowercased), query to V1 handler', async ({
      apiGatewayLambdaAuthorizerRequestV1HandlerEvent,
    }) => {
      const handler = vi.fn().mockResolvedValue(generatePolicy('user', 'Allow', 'arn:...'));
      router.request({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerRequestV1HandlerEvent({
        event: {
          httpMethod: 'POST',
          path: '/users',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer abc' },
          queryStringParameters: { page: '1' },
        },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/users',
          headers: { 'content-type': 'application/json', authorization: 'Bearer abc' },
          query: { page: '1' },
        }),
      );
    });

    test('passes type, resourceArn, event, context for V1', async ({
      apiGatewayLambdaAuthorizerRequestV1HandlerEvent,
    }) => {
      const handler = vi.fn().mockResolvedValue(generatePolicy('user', 'Allow', 'arn:...'));
      router.request({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerRequestV1HandlerEvent({
        event: { methodArn: 'arn:aws:execute-api:us-east-1:123:abc/prod/POST/users' },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REQUEST',
          resourceArn: 'arn:aws:execute-api:us-east-1:123:abc/prod/POST/users',
          event,
          context,
        }),
      );
    });

    test('calls matched REQUEST handler for V2 event', async ({ apiGatewayLambdaAuthorizerRequestV2HandlerEvent }) => {
      const policy = generatePolicy('user', 'Allow', 'arn:...');
      const handler = vi.fn().mockResolvedValue(policy);
      router.request({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerRequestV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(result).toEqual(policy);
    });

    test('passes method, path (rawPath), headers, query to V2 handler', async ({
      apiGatewayLambdaAuthorizerRequestV2HandlerEvent,
    }) => {
      const handler = vi.fn().mockResolvedValue(generatePolicy('user', 'Allow', 'arn:...'));
      router.request({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerRequestV2HandlerEvent({
        event: {
          rawPath: '/items',
          headers: { 'content-type': 'application/json' },
          queryStringParameters: { limit: '10' },
          requestContext: { http: { method: 'GET' } },
        },
      });
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/items',
          headers: { 'content-type': 'application/json' },
          query: { limit: '10' },
        }),
      );
    });

    test('converts boolean true return to { isAuthorized: true } for V2', async ({
      apiGatewayLambdaAuthorizerRequestV2HandlerEvent,
    }) => {
      const handler = vi.fn().mockResolvedValue(true);
      router.request({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerRequestV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({ isAuthorized: true });
    });

    test('converts boolean false return to { isAuthorized: false } for V2', async ({
      apiGatewayLambdaAuthorizerRequestV2HandlerEvent,
    }) => {
      const handler = vi.fn().mockResolvedValue(false);
      router.request({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerRequestV2HandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual({ isAuthorized: false });
    });

    test('throws when no route matches', async ({ apiGatewayLambdaAuthorizerTokenHandlerEvent }) => {
      const { event, context } = apiGatewayLambdaAuthorizerTokenHandlerEvent();

      await expect(router.handleEvent(event, context)).rejects.toThrow(
        'No route matched for Lambda Authorizer event (type: TOKEN, method: N/A)',
      );
    });

    test('throws when boolean returned for non-V2 event', async ({ apiGatewayLambdaAuthorizerTokenHandlerEvent }) => {
      const handler = vi.fn().mockResolvedValue(true);
      router.token({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerTokenHandlerEvent();

      await expect(router.handleEvent(event, context)).rejects.toThrow(
        'Boolean responses are only supported for HTTP API (v2) request authorizers using simple response mode',
      );
    });

    test('catches and returns thrown authorizer response', async ({ apiGatewayLambdaAuthorizerTokenHandlerEvent }) => {
      const thrownPolicy = generatePolicy('user-1', 'Deny', 'arn:aws:execute-api:*:*:*');
      const handler = vi.fn().mockRejectedValue(thrownPolicy);
      router.token({ handler });

      const { event, context } = apiGatewayLambdaAuthorizerTokenHandlerEvent();
      const result = await router.handleEvent(event, context);

      expect(result).toEqual(thrownPolicy);
    });

    test('matches request route with specific method filter', async ({
      apiGatewayLambdaAuthorizerRequestV1HandlerEvent,
    }) => {
      const getHandler = vi.fn().mockResolvedValue(generatePolicy('user', 'Allow', 'arn:...'));
      const postHandler = vi.fn().mockResolvedValue(generatePolicy('user', 'Allow', 'arn:...'));

      router.request({ method: 'GET', handler: getHandler });
      router.request({ method: 'POST', handler: postHandler });

      const { event, context } = apiGatewayLambdaAuthorizerRequestV1HandlerEvent({
        event: { httpMethod: 'POST' },
      });
      await router.handleEvent(event, context);

      expect(getHandler).not.toHaveBeenCalled();
      expect(postHandler).toHaveBeenCalledTimes(1);
    });

    test('does not match request route when method differs', async ({
      apiGatewayLambdaAuthorizerRequestV1HandlerEvent,
    }) => {
      router.request({ method: 'DELETE', handler: vi.fn() });

      const { event, context } = apiGatewayLambdaAuthorizerRequestV1HandlerEvent({
        event: { httpMethod: 'GET' },
      });

      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched for Lambda Authorizer event');
    });
  });

  suite('extractFilterInput (private)', () => {
    test('returns { type: "TOKEN" } for TOKEN events', () => {
      const event = createApiGatewayLambdaAuthorizerTokenEvent();

      // @ts-expect-error - testing private method
      const result = router.extractFilterInput(event);

      expect(result).toEqual({ type: 'TOKEN' });
    });

    test('returns { type: "REQUEST", method } for V1 events', () => {
      const event = createApiGatewayLambdaAuthorizerRequestV1Event({ httpMethod: 'GET' });

      // @ts-expect-error - testing private method
      const result = router.extractFilterInput(event);

      expect(result).toEqual({ type: 'REQUEST', method: 'GET' });
    });

    test('returns { type: "REQUEST", method } for V2 events from requestContext.http.method', () => {
      const event = createApiGatewayLambdaAuthorizerRequestV2Event({
        requestContext: { http: { method: 'POST' } },
      });

      // @ts-expect-error - testing private method
      const result = router.extractFilterInput(event);

      expect(result).toEqual({ type: 'REQUEST', method: 'POST' });
    });

    test('throws for unrecognised event format', () => {
      const event = { type: 'REQUEST' };

      // @ts-expect-error - testing private method with invalid event
      expect(() => router.extractFilterInput(event)).toThrow('Unrecognised REQUEST authorizer event');
    });
  });

  suite('buildRequest (private)', () => {
    test('builds token request with authorizationToken and methodArn as resourceArn', ({ context }) => {
      const event = createApiGatewayLambdaAuthorizerTokenEvent({
        authorizationToken: 'Bearer secret',
        methodArn: 'arn:aws:execute-api:us-east-1:123:abc/prod/GET/items',
      });
      const mockContext = context();

      // @ts-expect-error - testing private method
      const result = router.buildRequest(event, mockContext, { type: 'TOKEN' });

      expect(result).toEqual(
        expect.objectContaining({
          type: 'TOKEN',
          resourceArn: 'arn:aws:execute-api:us-east-1:123:abc/prod/GET/items',
          authorizationToken: 'Bearer secret',
        }),
      );
    });

    test('builds V1 request with lowercased headers, path, query, methodArn as resourceArn', ({ context }) => {
      const event = createApiGatewayLambdaAuthorizerRequestV1Event({
        path: '/users',
        httpMethod: 'POST',
        headers: { 'Content-Type': 'application/json' },
        queryStringParameters: { page: '1' },
        methodArn: 'arn:method',
      });
      const mockContext = context();

      // @ts-expect-error - testing private method
      const result = router.buildRequest(event, mockContext, { type: 'REQUEST', method: 'POST' });

      expect(result).toEqual(
        expect.objectContaining({
          type: 'REQUEST',
          resourceArn: 'arn:method',
          method: 'POST',
          path: '/users',
          headers: { 'content-type': 'application/json' },
          query: { page: '1' },
        }),
      );
    });

    test('builds V2 request with headers, rawPath as path, query, routeArn as resourceArn', ({ context }) => {
      const event = createApiGatewayLambdaAuthorizerRequestV2Event({
        rawPath: '/items',
        headers: { authorization: 'Bearer token' },
        queryStringParameters: { limit: '5' },
        routeArn: 'arn:route',
        requestContext: { http: { method: 'GET' } },
      });
      const mockContext = context();

      // @ts-expect-error - testing private method
      const result = router.buildRequest(event, mockContext, { type: 'REQUEST', method: 'GET' });

      expect(result).toEqual(
        expect.objectContaining({
          type: 'REQUEST',
          resourceArn: 'arn:route',
          method: 'GET',
          path: '/items',
          headers: { authorization: 'Bearer token' },
          query: { limit: '5' },
        }),
      );
    });

    test('includes event and context in all request types', ({ context }) => {
      const event = createApiGatewayLambdaAuthorizerTokenEvent();
      const mockContext = context();

      // @ts-expect-error - testing private method
      const result = router.buildRequest(event, mockContext, { type: 'TOKEN' });

      expect(result.event).toBe(event);
      expect(result.context).toBe(mockContext);
    });

    test('returns empty object for null headers in V1', ({ context }) => {
      const event = createApiGatewayLambdaAuthorizerRequestV1Event({ headers: null });
      const mockContext = context();

      // @ts-expect-error - testing private method
      const result = router.buildRequest(event, mockContext, { type: 'REQUEST', method: 'GET' });

      expect(result.headers).toEqual({});
    });

    test('returns empty object for null query in V1', ({ context }) => {
      const event = createApiGatewayLambdaAuthorizerRequestV1Event({ queryStringParameters: null });
      const mockContext = context();

      // @ts-expect-error - testing private method
      const result = router.buildRequest(event, mockContext, { type: 'REQUEST', method: 'GET' });

      expect(result.query).toEqual({});
    });

    test('returns empty object for undefined headers in V2', ({ context }) => {
      const event = createApiGatewayLambdaAuthorizerRequestV2Event({ headers: undefined });
      const mockContext = context();

      // @ts-expect-error - testing private method
      const result = router.buildRequest(event, mockContext, { type: 'REQUEST', method: 'GET' });

      expect(result.headers).toEqual({});
    });

    test('returns empty object for undefined query in V2', ({ context }) => {
      const event = createApiGatewayLambdaAuthorizerRequestV2Event({ queryStringParameters: undefined });
      const mockContext = context();

      // @ts-expect-error - testing private method
      const result = router.buildRequest(event, mockContext, { type: 'REQUEST', method: 'GET' });

      expect(result.query).toEqual({});
    });

    test('throws for unrecognized event format', ({ context }) => {
      const mockContext = context();

      // @ts-expect-error - testing with invalid event that bypasses type guards
      expect(() => router.buildRequest({ type: 'REQUEST' }, mockContext, { type: 'REQUEST', method: 'GET' })).toThrow(
        'Unrecognized Lambda Authorizer event format',
      );
    });
  });

  suite('matchRoute (private)', () => {
    test('matches route with matching type filter', async () => {
      router.token({ handler: async () => generatePolicy('user', 'Allow', 'arn:...') });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'TOKEN' });

      expect(result).toBeDefined();
    });

    test('does not match route with different type filter', async () => {
      router.token({ handler: async () => generatePolicy('user', 'Allow', 'arn:...') });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'REQUEST', method: 'GET' });

      expect(result).toBeUndefined();
    });

    test('matches route with matching method filter', async () => {
      router.request({ method: 'POST', handler: async () => generatePolicy('user', 'Allow', 'arn:...') });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'REQUEST', method: 'POST' });

      expect(result).toBeDefined();
    });

    test('does not match route with different method filter', async () => {
      router.request({ method: 'POST', handler: async () => generatePolicy('user', 'Allow', 'arn:...') });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'REQUEST', method: 'GET' });

      expect(result).toBeUndefined();
    });

    test('route without type filter matches any type', async () => {
      const definition = defineLambdaAuthorizerRoute({ filters: {} }).handle(async () =>
        generatePolicy('user', 'Allow', 'arn:...'),
      );
      router.route(definition);

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'TOKEN' });

      expect(result).toBeDefined();
    });

    test('route without method filter matches any method', async () => {
      router.request({ handler: async () => generatePolicy('user', 'Allow', 'arn:...') });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'REQUEST', method: 'DELETE' });

      expect(result).toBeDefined();
    });

    test('returns first matching route when multiple match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.request({ handler: firstHandler });
      router.request({ handler: secondHandler });

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'REQUEST', method: 'GET' });

      expect(result?.handler).toBe(firstHandler);
    });

    test('matches route by customFilter', async () => {
      router.route(
        defineLambdaAuthorizerRoute({
          filters: {
            customFilter: ({ type }: LambdaAuthorizerFilterInput): boolean => type === 'TOKEN',
          },
        }).handle(async () => generatePolicy('user', 'Allow', 'arn:...')),
      );

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'TOKEN' });

      expect(result).toBeDefined();
    });

    test('matches route by async customFilter', async () => {
      router.route(
        defineLambdaAuthorizerRoute({
          filters: {
            customFilter: async ({ type }: LambdaAuthorizerFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              return type === 'TOKEN';
            },
          },
        }).handle(async () => generatePolicy('user', 'Allow', 'arn:...')),
      );

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'TOKEN' });

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', async () => {
      router.route(
        defineLambdaAuthorizerRoute({
          filters: {
            customFilter: (): boolean => false,
          },
        }).handle(async () => generatePolicy('user', 'Allow', 'arn:...')),
      );

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'TOKEN' });

      expect(result).toBeUndefined();
    });

    test('passes correct filterInput to customFilter', async () => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.route(
        defineLambdaAuthorizerRoute({
          filters: { customFilter },
        }).handle(async () => generatePolicy('user', 'Allow', 'arn:...')),
      );

      // @ts-expect-error - testing private method
      router.matchRoute({ type: 'REQUEST', method: 'POST' });

      expect(customFilter).toHaveBeenCalledWith({
        type: 'REQUEST',
        method: 'POST',
      });
    });

    test('matches when standard filters and customFilter both pass', async () => {
      router.route(
        defineLambdaAuthorizerRoute({
          filters: {
            type: 'REQUEST',
            customFilter: ({ method }: LambdaAuthorizerFilterInput): boolean => method === 'POST',
          },
        }).handle(async () => generatePolicy('user', 'Allow', 'arn:...')),
      );

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'REQUEST', method: 'POST' });

      expect(result).toBeDefined();
    });

    test('does not match when standard filters pass but customFilter returns false', async () => {
      router.route(
        defineLambdaAuthorizerRoute({
          filters: {
            type: 'REQUEST',
            customFilter: (): boolean => false,
          },
        }).handle(async () => generatePolicy('user', 'Allow', 'arn:...')),
      );

      // @ts-expect-error - testing private method
      const result = await router.matchRoute({ type: 'REQUEST', method: 'POST' });

      expect(result).toBeUndefined();
    });

    test('customFilter is not called when an earlier filter fails', () => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.route(
        defineLambdaAuthorizerRoute({
          filters: {
            type: 'TOKEN',
            customFilter,
          },
        }).handle(async () => generatePolicy('user', 'Allow', 'arn:...')),
      );

      // @ts-expect-error - testing private method
      router.matchRoute({ type: 'REQUEST', method: 'GET' });

      expect(customFilter).not.toHaveBeenCalled();
    });
  });
});

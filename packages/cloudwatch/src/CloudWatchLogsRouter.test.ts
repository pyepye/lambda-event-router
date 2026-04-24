import type { CloudWatchLogsDecodedData } from 'aws-lambda';

import { createCloudWatchLogsEvent, test } from '@lambda-event-router/testing';

import { CloudWatchLogsRouter, createCloudWatchLogsRouter, defineRoute } from './CloudWatchLogsRouter.js';
import type { CloudWatchLogsRequest } from './types.js';

type CloudWatchLogsNext = (request: CloudWatchLogsRequest) => Promise<void>;

suite('CloudWatchLogsRouter', () => {
  let router: CloudWatchLogsRouter;

  beforeEach(() => {
    router = new CloudWatchLogsRouter();
  });

  suite('createCloudWatchLogsRouter', () => {
    test('creates a CloudWatchLogsRouter instance', () => {
      const router = createCloudWatchLogsRouter();
      expect(router).toBeInstanceOf(CloudWatchLogsRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns true for a valid CloudWatch Logs event', () => {
      const event = createCloudWatchLogsEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for a non-CloudWatch Logs event', () => {
      const event = { detail: { foo: 'bar' }, source: 'custom.app' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for null', () => {
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false when awslogs is not an object', () => {
      expect(router.canHandleEvent({ awslogs: 'not-an-object' })).toBe(false);
    });

    test('returns false when awslogs.data is not a string', () => {
      expect(router.canHandleEvent({ awslogs: { data: 123 } })).toBe(false);
    });
  });

  suite('defineRoute', () => {
    test('returns a route builder with a handle method', () => {
      const builder = defineRoute({
        filters: { logGroup: '/aws/lambda/my-function' },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters and handler in the definition', () => {
      const handler = vi.fn();
      const filters = {
        logGroup: '/aws/lambda/my-function',
        messageType: 'DATA_MESSAGE' as const,
      };

      const definition = defineRoute({ filters }).handle(handler);

      expect(definition).toEqual({ filters, middleware: [], handler });
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: { logGroup: '/aws/lambda/my-function' },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('dataMessage', () => {
    test('returns the router instance for chaining', () => {
      const result = router.dataMessage({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('forces messageType to DATA_MESSAGE in filters', async () => {
      const handler = vi.fn();
      router.dataMessage({ filters: { logGroup: '/aws/lambda/my-function' }, handler });

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute(decodedData);
      expect(matched).toBeDefined();

      const controlData: CloudWatchLogsDecodedData = {
        ...decodedData,
        messageType: 'CONTROL_MESSAGE',
      };
      // @ts-expect-error - testing private method directly
      const notMatched = await router.matchRoute(controlData);
      expect(notMatched).toBeUndefined();
    });
  });

  suite('controlMessage', () => {
    test('returns the router instance for chaining', () => {
      const result = router.controlMessage({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('forces messageType to CONTROL_MESSAGE in filters', async () => {
      const handler = vi.fn();

      router.controlMessage({ filters: { logGroup: '/aws/lambda/my-function' }, handler });

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'CONTROL_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const matched = await router.matchRoute(decodedData);
      expect(matched).toBeDefined();

      const dataMsg: CloudWatchLogsDecodedData = {
        ...decodedData,
        messageType: 'DATA_MESSAGE',
      };
      // @ts-expect-error - testing private method directly
      const notMatched = await router.matchRoute(dataMsg);
      expect(notMatched).toBeUndefined();
    });
  });

  suite('decodeLogData', () => {
    test('decodes base64 + gzip compressed log data', () => {
      const event = createCloudWatchLogsEvent({
        owner: '111222333444',
        logGroup: '/aws/lambda/test-func',
      });

      // @ts-expect-error - testing private method directly
      const result = router.decodeLogData(event.awslogs.data);

      expect(result.owner).toBe('111222333444');
      expect(result.logGroup).toBe('/aws/lambda/test-func');
    });

    test('returns parsed CloudWatchLogsDecodedData', () => {
      const event = createCloudWatchLogsEvent();

      // @ts-expect-error - testing private method directly
      const result = router.decodeLogData(event.awslogs.data);

      expect(result).toHaveProperty('owner');
      expect(result).toHaveProperty('logGroup');
      expect(result).toHaveProperty('logStream');
      expect(result).toHaveProperty('subscriptionFilters');
      expect(result).toHaveProperty('messageType');
      expect(result).toHaveProperty('logEvents');
    });
  });

  suite('matchRoute', () => {
    let decodedData: CloudWatchLogsDecodedData;

    beforeEach(() => {
      decodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
    });

    test('matches route by messageType', async () => {
      router.route(
        defineRoute({
          filters: { messageType: 'DATA_MESSAGE' },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('matches route by messageType array', async () => {
      router.route(
        defineRoute({
          filters: { messageType: ['DATA_MESSAGE', 'CONTROL_MESSAGE'] },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when messageType does not match', async () => {
      router.route(
        defineRoute({
          filters: { messageType: 'CONTROL_MESSAGE' },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches route by logGroup', async () => {
      router.route(
        defineRoute({
          filters: { logGroup: '/aws/lambda/my-function' },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('matches route by logGroup array', async () => {
      router.route(
        defineRoute({
          filters: { logGroup: ['/aws/lambda/my-function', '/aws/lambda/other-function'] },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when logGroup does not match', async () => {
      router.route(
        defineRoute({
          filters: { logGroup: '/aws/lambda/other-function' },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches route by logGroup wildcard', async () => {
      router.route(
        defineRoute({
          filters: { logGroup: '*lambda*' },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('matches route by logGroup wilcard array', async () => {
      router.route(
        defineRoute({
          filters: { logGroup: ['*lambda*', '*cognito*'] },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when logGroup wildcard does not match', async () => {
      router.route(
        defineRoute({
          filters: { logGroup: '*ecs*' },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches route by subscriptionFilter', async () => {
      router.route(
        defineRoute({
          filters: { subscriptionFilter: 'my-filter' },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('matches route by subscriptionFilter array', async () => {
      router.route(
        defineRoute({
          filters: { subscriptionFilter: ['my-filter', 'other-filter'] },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when subscriptionFilter does not match', async () => {
      router.route(
        defineRoute({
          filters: { subscriptionFilter: 'other-filter' },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', async () => {
      router.route(
        defineRoute({
          filters: {
            customFilter: (input: CloudWatchLogsDecodedData): boolean => {
              return input.owner === '123456789012';
            },
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when customFilter returns false', async () => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches route by async customFilter', async () => {
      router.route(
        defineRoute({
          filters: {
            customFilter: async (input: CloudWatchLogsDecodedData): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              return input.owner === '123456789012';
            },
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('matches with empty filters as catch-all', async () => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('selects first matching route when multiple match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(
        defineRoute({
          filters: { logGroup: '/aws/lambda/my-function' },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { logGroup: '/aws/lambda/my-function' },
        }).handle(secondHandler),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('matches when multiple filter types all match', async () => {
      router.route(
        defineRoute({
          filters: {
            logGroup: '/aws/lambda/my-function',
            messageType: 'DATA_MESSAGE',
            subscriptionFilter: 'my-filter',
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when one filter type fails but others match', async () => {
      router.route(
        defineRoute({
          filters: {
            logGroup: '/aws/lambda/my-function',
            messageType: 'CONTROL_MESSAGE',
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler with decoded data and context', async ({ cloudWatchLogsHandlerEvent }) => {
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { logGroup: '/aws/lambda/my-function' },
        }).handle(handler),
      );

      const { event, context } = cloudWatchLogsHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledOnce();
    });

    test('throws when no route matches', async ({ cloudWatchLogsHandlerEvent }) => {
      const { event, context } = cloudWatchLogsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler errors', async ({ cloudWatchLogsHandlerEvent }) => {
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = cloudWatchLogsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('verifies the request shape', async ({ context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const logGroup = '/aws/lambda/test-func';
      const logStream = '2024/01/01/[$LATEST]def456';
      const owner = '999888777666';
      const subscriptionFilters = ['test-sub-filter'];
      const logEvents = [{ id: 'event-1', timestamp: 1704067200000, message: 'hello world' }];

      const event = createCloudWatchLogsEvent({
        logGroup,
        logStream,
        owner,
        subscriptionFilters,
        messageType: 'DATA_MESSAGE',
        logEvents,
      });
      const ctx = context();
      await router.handleEvent(event, ctx);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          logGroup,
          logStream,
          owner,
          subscriptionFilters,
          messageType: 'DATA_MESSAGE',
          logEvents,
          context: ctx,
        }),
      );
    });
  });

  suite('full event processing', () => {
    test('routes events to different handlers based on different filter criteria', async ({ context }) => {
      const lambdaHandler = vi.fn();
      const ecsHandler = vi.fn();

      router.route(
        defineRoute({
          filters: { logGroup: '/aws/lambda/*' },
        }).handle(lambdaHandler),
      );
      router.route(
        defineRoute({
          filters: { logGroup: '/aws/ecs/*' },
        }).handle(ecsHandler),
      );

      const ctx = context();

      const lambdaEvent = createCloudWatchLogsEvent({ logGroup: '/aws/lambda/my-function' });
      await router.handleEvent(lambdaEvent, ctx);

      const ecsEvent = createCloudWatchLogsEvent({ logGroup: '/aws/ecs/my-service' });
      await router.handleEvent(ecsEvent, ctx);

      expect(lambdaHandler).toHaveBeenCalledTimes(1);
      expect(ecsHandler).toHaveBeenCalledTimes(1);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ cloudWatchLogsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: CloudWatchLogsRequest, next: CloudWatchLogsNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createCloudWatchLogsRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = cloudWatchLogsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ cloudWatchLogsHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: CloudWatchLogsRequest, _next: CloudWatchLogsNext): Promise<void> {
        return;
      }

      const router = createCloudWatchLogsRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = cloudWatchLogsHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ cloudWatchLogsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: CloudWatchLogsRequest, next: CloudWatchLogsNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: CloudWatchLogsRequest, next: CloudWatchLogsNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createCloudWatchLogsRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = cloudWatchLogsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ cloudWatchLogsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: CloudWatchLogsRequest, next: CloudWatchLogsNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = cloudWatchLogsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({
      cloudWatchLogsHandlerEvent,
    }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(
        _request: CloudWatchLogsRequest,
        _next: CloudWatchLogsNext,
      ): Promise<void> {
        return;
      }

      router.route({
        filters: {},
        middleware: [blockingRouteMiddleware],
        handler,
      });

      const { event, context } = cloudWatchLogsHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ cloudWatchLogsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: CloudWatchLogsRequest, next: CloudWatchLogsNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: CloudWatchLogsRequest, next: CloudWatchLogsNext): Promise<void> {
        callOrder.push('route-mw2');
        await next(request);
      }

      router.route({
        filters: {},
        middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = cloudWatchLogsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ cloudWatchLogsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: CloudWatchLogsRequest, next: CloudWatchLogsNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });

      router.route(route);

      const { event, context } = cloudWatchLogsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ cloudWatchLogsHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: CloudWatchLogsRequest, next: CloudWatchLogsNext): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: CloudWatchLogsRequest, next: CloudWatchLogsNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createCloudWatchLogsRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = cloudWatchLogsHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({
      cloudWatchLogsHandlerEvent,
    }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(
        _request: CloudWatchLogsRequest,
        _next: CloudWatchLogsNext,
      ): Promise<void> {
        return;
      }

      const router = createCloudWatchLogsRouter({ middleware: [blockingRouterMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler,
      });

      const { event, context } = cloudWatchLogsHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

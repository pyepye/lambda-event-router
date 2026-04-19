import { createMockContext, createMockSchema } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';

import * as data from '../utils/data.js';
import { createEventRouter, defineEventRoute, EventRouter } from './EventRouter.js';
import type { EventFilterInput, EventRequest } from './types.js';

type EventNext = (request: EventRequest) => Promise<unknown>;

const validateSchemaSpy: MockInstance = vi.spyOn(data, 'validateSchema');

suite('EventRouter', () => {
  let router: EventRouter;

  beforeEach(() => {
    router = new EventRouter();
  });

  suite('createEventRouter', () => {
    test('creates an EventRouter instance', () => {
      const router = createEventRouter();
      expect(router).toBeInstanceOf(EventRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns false for null', async () => {
      expect(await router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', async () => {
      expect(await router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for a known SQS event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known SNS event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ EventSource: 'aws:sns' }] };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known S3 event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:s3' }] };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known DynamoDB Stream event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:dynamodb' }] };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Kinesis event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:kinesis' }] };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known API Gateway V2 event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { rawPath: '/test', requestContext: { http: { method: 'GET' } } };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Cognito event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { triggerSource: 'PreSignUp_SignUp', userPoolId: 'us-east-1_TestPool' };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known CodeCommit event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:codecommit' }] };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known SES event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:ses' }] };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known DocumentDB event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:docdb', events: [] };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known ActiveMQ event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:mq', messages: [] };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known RabbitMQ event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:rmq', rmqMessagesByQueue: {} };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known ALB event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { requestContext: { elb: { targetGroupArn: 'arn:aws:elasticloadbalancing:...' } } };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known API Gateway V1 event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { httpMethod: 'GET', requestContext: { accountId: '123' } };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known VPC Lattice V1 event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { raw_path: '/test', method: 'GET' };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known VPC Lattice V2 event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { requestContext: { serviceArn: 'arn:aws:vpc-lattice:...' } };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known AppSync resolver event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { info: { parentTypeName: 'Query', fieldName: 'getItem' } };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known AppSync channel event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { info: { channel: '/default/test' } };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known AppSync Authorizer event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { authorizationToken: 'Bearer token', requestContext: { apiId: 'abc123' } };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known CloudWatch Logs event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { awslogs: { data: 'base64data' } };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known CodePipeline event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { 'CodePipeline.job': { id: 'job-123' } };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Config event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { invokingEvent: '{}', configRuleName: 'my-rule' };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Connect event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Name: 'ContactFlowEvent' };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Lex event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { sessionState: { intent: {} }, bot: { name: 'my-bot' } };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Secrets Manager event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { SecretId: 'arn:aws:secretsmanager:...', Step: 'createSecret' };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns true for an arbitrary object when a catch-all route is registered', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      expect(await router.canHandleEvent({ taskId: 'task-123' })).toBe(true);
    });

    test('returns false for a known Kafka (MSK) event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:kafka', bootstrapServers: 'b-1.demo:9092', records: { 'topic-1-0': [] } };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known self-managed Kafka event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = {
        eventSource: 'SelfManagedKafka',
        bootstrapServers: 'b-1.demo:9092',
        records: { 'topic-1-0': [] },
      };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Firehose event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = {
        invocationId: 'invocation-123',
        deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream',
        region: 'us-east-1',
        records: [{ recordId: 'record-1', data: 'base64data' }],
      };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known S3 Batch event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = {
        invocationSchemaVersion: '1.0',
        invocationId: 'invocation-123',
        job: { id: 'job-123' },
        tasks: [{ taskId: 'task-1', s3Key: 'key', s3BucketArn: 'arn:aws:s3:::bucket' }],
      };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for an EventBridge envelope event', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = {
        version: '0',
        id: 'abc',
        source: 'my.app',
        'detail-type': 'Test',
        account: '123456789012',
        time: '2024-01-01T00:00:00Z',
        region: 'us-east-1',
        resources: [],
        detail: {},
      };
      expect(await router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when no routes are registered', async () => {
      expect(await router.canHandleEvent({ taskId: 'task-123' })).toBe(false);
    });

    test('returns false when no routes match via customFilter', async () => {
      router.route(
        defineEventRoute({
          filters: { customFilter: () => false },
        }).handle(async () => {}),
      );
      expect(await router.canHandleEvent({ taskId: 'task-123' })).toBe(false);
    });

    test('returns true when a customFilter matches', async () => {
      router.route(
        defineEventRoute({
          filters: {
            customFilter: ({ event }: EventFilterInput): boolean => {
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.taskId === 'task-123';
            },
          },
        }).handle(async () => {}),
      );
      expect(await router.canHandleEvent({ taskId: 'task-123' })).toBe(true);
    });

    test('returns true for Records array with non-object first element when route matches', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [42] };
      expect(await router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for Records array with unknown eventSource when route matches', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:unknown' }] };
      expect(await router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for unknown top-level eventSource string when route matches', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'custom:unknown' };
      expect(await router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for requestContext without serviceArn or full AppSync Authorizer shape when route matches', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { requestContext: { apiId: 'abc123' } };
      expect(await router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for info object without parentTypeName or channel when route matches', async () => {
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { info: { someOtherField: 'value' } };
      expect(await router.canHandleEvent(event)).toBe(true);
    });
  });

  suite('defineEventRoute', () => {
    test('preserves filters, eventSchema, and handler', () => {
      const eventSchema = createMockSchema();
      const handler = vi.fn();
      const filters = { customFilter: () => true };

      const definition = defineEventRoute({
        filters,
        eventSchema,
      }).handle(handler);

      expect(definition).toEqual({
        filters,
        eventSchema,
        handler,
      });
    });

    test('customFilter receives typed event when eventSchema is provided', () => {
      const eventSchema = createMockSchema<{ taskId: string }>();
      const isTaskEvent = (event: unknown): event is { taskId: string } =>
        typeof event === 'object' &&
        event !== null &&
        'taskId' in event &&
        typeof (event as { taskId?: unknown }).taskId === 'string';

      const definition = defineEventRoute({
        filters: {
          customFilter: ({ event }: EventFilterInput<{ taskId: string }>) =>
            isTaskEvent(event) && event.taskId === 'task-123',
        },
        eventSchema,
      }).handle(async () => {});

      expect(definition.filters.customFilter).toBeDefined();
    });

    test('customFilter event defaults to unknown when no eventSchema is provided', () => {
      const customFilter = vi.fn().mockReturnValue(true);
      const definition = defineEventRoute({
        filters: { customFilter },
      }).handle(async () => {});

      expect(definition.filters.customFilter).toBe(customFilter);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineEventRoute({
        filters: {},
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches route by customFilter', async () => {
      router.route(
        defineEventRoute({
          filters: {
            customFilter: ({ event }: EventFilterInput): boolean => {
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.taskId === 'task-123';
            },
          },
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('matches route by customFilter', async () => {
      router.route(
        defineEventRoute({
          filters: {
            customFilter: async ({ event }: EventFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.taskId === 'task-123';
            },
          },
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('matches route with empty filters as catch-all', async () => {
      router.route(
        defineEventRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match when customFilter returns false', async () => {
      router.route(
        defineEventRoute({
          filters: { customFilter: () => false },
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('passes correct filterInput to customFilter', async () => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.route(
        defineEventRoute({
          filters: { customFilter },
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      await router.matchRoute(event);

      expect(customFilter).toHaveBeenCalledWith({ event });
    });

    test('selects the first matching route when multiple routes match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(defineEventRoute({ filters: {} }).handle(firstHandler));
      router.route(defineEventRoute({ filters: {} }).handle(secondHandler));

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute(event);

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });
  });

  suite('handleEvent', () => {
    test('calls handler with request object containing event and context', async () => {
      const handler = vi.fn();
      router.route(
        defineEventRoute({
          filters: {},
          eventSchema: createMockSchema(),
        }).handle(handler),
      );

      const event = { taskId: 'task-123', payload: 'data' };
      const context = createMockContext();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith({ event, context });
    });

    test('throws when no route matches', async () => {
      await expect(router.handleEvent({ taskId: 'task-123' }, createMockContext())).rejects.toThrow(
        'No route matched for event',
      );
    });

    test('handler receives validated event from eventSchema in request object', async () => {
      const handler = vi.fn();
      const eventSchema = createMockSchema();
      router.route(
        defineEventRoute({
          filters: {},
          eventSchema,
        }).handle(handler),
      );

      const event = { taskId: 'task-123' };
      const context = createMockContext();
      await router.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(event, eventSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith({ event, context });
    });

    test('throws when eventSchema validation fails', async () => {
      router.route(
        defineEventRoute({
          filters: {},
          eventSchema: createMockSchema({ issues: [{ message: 'invalid event' }] }),
        }).handle(async () => {}),
      );

      await expect(router.handleEvent({ taskId: 'task-123' }, createMockContext())).rejects.toThrow(
        'Schema validation failed for event',
      );
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async () => {
      const callOrder: string[] = [];

      async function middleware(request: EventRequest, next: EventNext): Promise<unknown> {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      }

      const router = createEventRouter({ middleware: [middleware] });
      router.route(
        defineEventRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      await router.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn();

      async function blockingMiddleware(_request: EventRequest, _next: EventNext): Promise<unknown> {
        // intentionally not calling next
        return undefined;
      }

      const router = createEventRouter({ middleware: [blockingMiddleware] });
      router.route(defineEventRoute({ filters: {} }).handle(handler));

      await router.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(handler).not.toHaveBeenCalled();
    });

    test('middleware receives request object with event and context', async () => {
      let capturedRequest: EventRequest | undefined;

      async function middleware(request: EventRequest, next: EventNext): Promise<unknown> {
        capturedRequest = request;
        return next(request);
      }

      const router = createEventRouter({ middleware: [middleware] });
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));

      const event = { taskId: 'task-123' };
      const context = createMockContext();
      await router.handleEvent(event, context);

      expect(capturedRequest).toEqual({ event, context });
    });

    test('middleware receives validated event from eventSchema', async () => {
      let capturedRequest: EventRequest | undefined;
      const eventSchema = createMockSchema();

      async function middleware(request: EventRequest, next: EventNext): Promise<unknown> {
        capturedRequest = request;
        return next(request);
      }

      const router = createEventRouter({ middleware: [middleware] });
      router.route(defineEventRoute({ filters: {}, eventSchema }).handle(async () => {}));

      const event = { taskId: 'task-123' };
      const context = createMockContext();
      await router.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(event, eventSchema, expect.any(String));
      expect(capturedRequest).toEqual({ event, context });
    });

    test('does not execute middleware when schema validation fails', async () => {
      const middleware = vi.fn();

      const router = createEventRouter({ middleware: [middleware] });
      router.route(
        defineEventRoute({
          filters: {},
          eventSchema: createMockSchema({ issues: [{ message: 'invalid event' }] }),
        }).handle(async () => {}),
      );

      await expect(router.handleEvent({ taskId: 'task-123' }, createMockContext())).rejects.toThrow(
        'Schema validation failed for event',
      );
      expect(middleware).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async () => {
      const callOrder: string[] = [];

      async function middlewareOne(request: EventRequest, next: EventNext): Promise<unknown> {
        callOrder.push('mw1-pre');
        const result = await next(request);
        callOrder.push('mw1-post');
        return result;
      }

      async function middlewareTwo(request: EventRequest, next: EventNext): Promise<unknown> {
        callOrder.push('mw2-pre');
        const result = await next(request);
        callOrder.push('mw2-post');
        return result;
      }

      const router = createEventRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route(
        defineEventRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      await router.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(callOrder).toEqual(['mw1-pre', 'mw2-pre', 'handler', 'mw2-post', 'mw1-post']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware via defineEventRoute', async () => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: EventRequest, next: EventNext): Promise<unknown> {
        callOrder.push('route-mw');
        return next(request);
      }

      router.route(
        defineEventRoute({
          filters: {},
          middleware: [routeMiddleware],
        }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      await router.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: EventRequest, _next: EventNext): Promise<unknown> {
        return undefined;
      }

      router.route(
        defineEventRoute({
          filters: {},
          middleware: [blockingRouteMiddleware],
        }).handle(handler),
      );

      await router.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async () => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: EventRequest, next: EventNext): Promise<unknown> {
        callOrder.push('route-mw1');
        return next(request);
      }

      async function routeMiddlewareTwo(request: EventRequest, next: EventNext): Promise<unknown> {
        callOrder.push('route-mw2');
        return next(request);
      }

      router.route(
        defineEventRoute({
          filters: {},
          middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      await router.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async () => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: EventRequest, next: EventNext): Promise<unknown> {
        callOrder.push('router-mw');
        return next(request);
      }

      async function routeMiddleware(request: EventRequest, next: EventNext): Promise<unknown> {
        callOrder.push('route-mw');
        return next(request);
      }

      const router = createEventRouter({ middleware: [routerMiddleware] });
      router.route(
        defineEventRoute({
          filters: {},
          middleware: [routeMiddleware],
        }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      await router.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async () => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: EventRequest, _next: EventNext): Promise<unknown> {
        return undefined;
      }

      const router = createEventRouter({ middleware: [blockingRouterMiddleware] });
      router.route(
        defineEventRoute({
          filters: {},
          middleware: [routeMiddleware],
        }).handle(handler),
      );

      await router.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('handler return value', () => {
    test('returns handler result from handleEvent', async () => {
      router.route(
        defineEventRoute({ filters: {} }).handle(async () => {
          return { orderId: 'order-123', status: 'processed' };
        }),
      );

      const result = await router.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(result).toEqual({ orderId: 'order-123', status: 'processed' });
    });

    test('returns handler result through middleware', async () => {
      async function middleware(request: EventRequest, next: EventNext): Promise<unknown> {
        return next(request);
      }

      const router = createEventRouter({ middleware: [middleware] });
      router.route(
        defineEventRoute({ filters: {} }).handle(async () => {
          return 'handler-result';
        }),
      );

      const result = await router.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(result).toBe('handler-result');
    });

    test('middleware can transform the handler return value', async () => {
      async function middleware(request: EventRequest, next: EventNext): Promise<unknown> {
        const result = await next(request);
        return { wrapped: result };
      }

      const router = createEventRouter({ middleware: [middleware] });
      router.route(
        defineEventRoute({ filters: {} }).handle(async () => {
          return 'original';
        }),
      );

      const result = await router.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(result).toEqual({ wrapped: 'original' });
    });
  });
});

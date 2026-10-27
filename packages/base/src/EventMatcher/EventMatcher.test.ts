import type { MockInstance } from 'vitest';

import { createMockContext, createMockSchema } from '@latcher/testing';

import * as data from '../utils/data.js';
import { createEventMatcher, defineEventRoute, EventMatcher } from './EventMatcher.js';
import type { EventFilterInput, EventRequest } from './types.js';

type EventNext = (request: EventRequest) => Promise<unknown>;

const validateSchemaSpy: MockInstance = vi.spyOn(data, 'validateSchema');

suite('EventMatcher', () => {
  let matcher: EventMatcher;

  beforeEach(() => {
    matcher = new EventMatcher();
  });

  suite('createEventMatcher', () => {
    test('creates an EventMatcher instance', () => {
      const matcher = createEventMatcher();
      expect(matcher).toBeInstanceOf(EventMatcher);
    });
  });

  suite('canHandleEvent', () => {
    test('returns false for null', async () => {
      expect(await matcher.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', async () => {
      expect(await matcher.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for a known SQS event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known SNS event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ EventSource: 'aws:sns' }] };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known S3 event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:s3' }] };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known DynamoDB Stream event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:dynamodb' }] };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Kinesis event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:kinesis' }] };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known API Gateway V2 event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { rawPath: '/test', requestContext: { http: { method: 'GET' } } };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Cognito event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { triggerSource: 'PreSignUp_SignUp', userPoolId: 'us-east-1_TestPool' };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known CodeCommit event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:codecommit' }] };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known SES event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:ses' }] };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known DocumentDB event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:docdb', events: [] };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known ActiveMQ event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:mq', messages: [] };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known RabbitMQ event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:rmq', rmqMessagesByQueue: {} };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known ALB event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { requestContext: { elb: { targetGroupArn: 'arn:aws:elasticloadbalancing:...' } } };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known API Gateway V1 event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { httpMethod: 'GET', requestContext: { accountId: '123' } };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known VPC Lattice V1 event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { raw_path: '/test', method: 'GET' };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known VPC Lattice V2 event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { requestContext: { serviceArn: 'arn:aws:vpc-lattice:...' } };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known AppSync resolver event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { info: { parentTypeName: 'Query', fieldName: 'getItem' } };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known AppSync channel event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { info: { channel: { path: '/default/test', segments: ['default', 'test'] } } };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known AppSync Authorizer event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { authorizationToken: 'Bearer token', requestContext: { apiId: 'abc123' } };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known CloudWatch Logs event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { awslogs: { data: 'base64data' } };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known CodePipeline event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { 'CodePipeline.job': { id: 'job-123' } };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Config event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { invokingEvent: '{}', configRuleName: 'my-rule' };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Connect event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Name: 'ContactFlowEvent' };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Lex event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { sessionState: { intent: {} }, bot: { name: 'my-bot' } };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Secrets Manager event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { SecretId: 'arn:aws:secretsmanager:...', Step: 'createSecret' };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns true for an arbitrary object when a catch-all route is registered', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      expect(await matcher.canHandleEvent({ taskId: 'task-123' })).toBe(true);
    });

    test('returns false for a known Kafka (MSK) event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:kafka', bootstrapServers: 'b-1.demo:9092', records: { 'topic-1-0': [] } };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known self-managed Kafka event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = {
        eventSource: 'SelfManagedKafka',
        bootstrapServers: 'b-1.demo:9092',
        records: { 'topic-1-0': [] },
      };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Firehose event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = {
        invocationId: 'invocation-123',
        deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream',
        region: 'us-east-1',
        records: [{ recordId: 'record-1', data: 'base64data' }],
      };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known S3 Batch event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = {
        invocationSchemaVersion: '1.0',
        invocationId: 'invocation-123',
        job: { id: 'job-123' },
        tasks: [{ taskId: 'task-1', s3Key: 'key', s3BucketArn: 'arn:aws:s3:::bucket' }],
      };
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false for an EventBridge envelope event', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
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
      expect(await matcher.canHandleEvent(event)).toBe(false);
    });

    test('returns false when no routes are registered', async () => {
      expect(await matcher.canHandleEvent({ taskId: 'task-123' })).toBe(false);
    });

    test('returns false when no routes match via custom', async () => {
      matcher.route(
        defineEventRoute({
          filters: { custom: () => false },
        }).handle(async () => {}),
      );
      expect(await matcher.canHandleEvent({ taskId: 'task-123' })).toBe(false);
    });

    test('returns true when a custom matches', async () => {
      matcher.route(
        defineEventRoute({
          filters: {
            custom: ({ event }: EventFilterInput): boolean => {
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.taskId === 'task-123';
            },
          },
        }).handle(async () => {}),
      );
      expect(await matcher.canHandleEvent({ taskId: 'task-123' })).toBe(true);
    });

    test('returns true for Records array with non-object first element when route matches', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [42] };
      expect(await matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns true for Records array with unknown eventSource when route matches', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:unknown' }] };
      expect(await matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns true for unknown top-level eventSource string when route matches', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'custom:unknown' };
      expect(await matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns true for requestContext without serviceArn or full AppSync Authorizer shape when route matches', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { requestContext: { apiId: 'abc123' } };
      expect(await matcher.canHandleEvent(event)).toBe(true);
    });

    test('returns true for info object without parentTypeName or channel when route matches', async () => {
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { info: { someOtherField: 'value' } };
      expect(await matcher.canHandleEvent(event)).toBe(true);
    });
  });

  suite('defineEventRoute', () => {
    test('preserves filters, eventSchema, and handler', () => {
      const eventSchema = createMockSchema();
      const handler = vi.fn();
      const filters = { custom: () => true };

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

    test('custom receives an unknown event when eventSchema is provided', () => {
      const eventSchema = createMockSchema<{ taskId: string }>();
      const isTaskEvent = (event: unknown): event is { taskId: string } =>
        typeof event === 'object' &&
        event !== null &&
        'taskId' in event &&
        typeof (event as { taskId?: unknown }).taskId === 'string';

      const definition = defineEventRoute({
        filters: {
          custom: ({ event }: EventFilterInput) => isTaskEvent(event) && event.taskId === 'task-123',
        },
        eventSchema,
      }).handle(async () => {});

      expect(definition.filters.custom).toBeDefined();
    });

    test('rejects a custom that reads the schema output without narrowing', () => {
      const definition = defineEventRoute({
        filters: {
          // @ts-expect-error - the filter runs before the schema, so event is unknown
          // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
          custom: ({ event }) => event.taskId === 'task-123',
        },
        eventSchema: createMockSchema<{ taskId: string }>(),
      }).handle(async () => {});

      expect(definition.filters.custom).toBeDefined();
    });

    test('custom event is unknown when no eventSchema is provided', () => {
      const custom = vi.fn().mockReturnValue(true);
      const definition = defineEventRoute({
        filters: { custom },
      }).handle(async () => {});

      expect(definition.filters.custom).toBe(custom);
    });
  });

  suite('route', () => {
    test('returns the matcher instance for chaining', () => {
      const definition = defineEventRoute({
        filters: {},
      }).handle(async () => {});

      const result = matcher.route(definition);

      expect(result).toBe(matcher);
    });

    test('a void matcher takes a bare defineEventRoute', () => {
      const voidMatcher = createEventMatcher<void>();

      const result = voidMatcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));

      expect(result).toBe(voidMatcher);
    });

    test('a void matcher rejects a handler that returns a value', () => {
      const voidMatcher = createEventMatcher<void>();

      // @ts-expect-error - every handler on this matcher returns nothing
      const result = voidMatcher.route(defineEventRoute({ filters: {} }).handle(async () => 'done'));

      expect(result).toBe(voidMatcher);
    });
  });

  suite('matchRoute', () => {
    test('matches route by custom', async () => {
      matcher.route(
        defineEventRoute({
          filters: {
            custom: ({ event }: EventFilterInput): boolean => {
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.taskId === 'task-123';
            },
          },
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('matches route by custom', async () => {
      matcher.route(
        defineEventRoute({
          filters: {
            custom: async ({ event }: EventFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              // @ts-expect-error - event is unknown, testing filter with known shape
              return event.taskId === 'task-123';
            },
          },
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('matches route with empty filters as catch-all', async () => {
      matcher.route(
        defineEventRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match when custom returns false', async () => {
      matcher.route(
        defineEventRoute({
          filters: { custom: () => false },
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('passes correct filterInput to custom', async () => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.route(
        defineEventRoute({
          filters: { custom },
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      await matcher.matchRoute(event);

      expect(custom).toHaveBeenCalledWith({ event });
    });

    test('selects the first matching route when multiple routes match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      matcher.route(defineEventRoute({ filters: {} }).handle(firstHandler));
      matcher.route(defineEventRoute({ filters: {} }).handle(secondHandler));

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute(event);

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('orders a guarded route ahead of the catch-all it shares filters with', async () => {
      const catchAll = vi.fn();
      const guarded = vi.fn();
      matcher.route(defineEventRoute({ filters: {} }).handle(catchAll));
      matcher.route(defineEventRoute({ filters: { custom: () => true } }).handle(guarded));

      // @ts-expect-error - testing private method directly
      const result = await matcher.matchRoute({ taskId: 'task-123' });

      expect(result?.handler).toBe(guarded);
    });
  });

  suite('custom filter evaluation', () => {
    test('runs each custom once across a canHandleEvent then handleEvent sequence', async () => {
      const custom = vi.fn().mockReturnValue(true);
      matcher.route(defineEventRoute({ filters: { custom } }).handle(async () => {}));

      const event = { taskId: 'task-123' };
      const context = createMockContext();
      // Mirror the Latcher dispatch: probe first, then handle the same event object.
      expect(await matcher.canHandleEvent(event)).toBe(true);
      await matcher.handleEvent(event, context);

      expect(custom).toHaveBeenCalledTimes(1);
    });

    test('still runs middleware and the handler when the match is served from cache', async () => {
      const custom = vi.fn().mockReturnValue(true);
      const handler = vi.fn();
      const middleware = vi.fn(async (request: EventRequest, next: EventNext) => next(request));

      const matcher = createEventMatcher({ middleware: [middleware] });
      matcher.route(defineEventRoute({ filters: { custom } }).handle(handler));

      const event = { taskId: 'task-123' };
      const context = createMockContext();
      // canHandleEvent caches the match; handleEvent reuses it but must still run everything else.
      await matcher.canHandleEvent(event);
      await matcher.handleEvent(event, context);

      expect(custom).toHaveBeenCalledTimes(1);
      expect(middleware).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  suite('handleEvent', () => {
    test('calls handler with request object containing event and context', async () => {
      const handler = vi.fn();
      matcher.route(
        defineEventRoute({
          filters: {},
          eventSchema: createMockSchema(),
        }).handle(handler),
      );

      const event = { taskId: 'task-123', payload: 'data' };
      const context = createMockContext();
      await matcher.handleEvent(event, context);

      expect(handler).toHaveBeenCalledWith({ event, context });
    });

    test('throws when no route matches', async () => {
      await expect(matcher.handleEvent({ taskId: 'task-123' }, createMockContext())).rejects.toThrow(
        'No route matched for event',
      );
    });

    test('handler receives validated event from eventSchema in request object', async () => {
      const handler = vi.fn();
      const eventSchema = createMockSchema();
      matcher.route(
        defineEventRoute({
          filters: {},
          eventSchema,
        }).handle(handler),
      );

      const event = { taskId: 'task-123' };
      const context = createMockContext();
      await matcher.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(event, eventSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith({ event, context });
    });

    test('throws when eventSchema validation fails', async () => {
      matcher.route(
        defineEventRoute({
          filters: {},
          eventSchema: createMockSchema({ issues: [{ message: 'invalid event' }] }),
        }).handle(async () => {}),
      );

      await expect(matcher.handleEvent({ taskId: 'task-123' }, createMockContext())).rejects.toThrow(
        'Schema validation failed for event',
      );
    });
  });

  suite('matcher-level middleware', () => {
    test('executes middleware before the route handler', async () => {
      const callOrder: string[] = [];

      async function middleware(request: EventRequest, next: EventNext): Promise<unknown> {
        callOrder.push('mw-pre');
        const result = await next(request);
        callOrder.push('mw-post');
        return result;
      }

      const matcher = createEventMatcher({ middleware: [middleware] });
      matcher.route(
        defineEventRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      await matcher.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn();

      async function blockingMiddleware(_request: EventRequest, _next: EventNext): Promise<unknown> {
        // intentionally not calling next
        return undefined;
      }

      const matcher = createEventMatcher({ middleware: [blockingMiddleware] });
      matcher.route(defineEventRoute({ filters: {} }).handle(handler));

      await matcher.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(handler).not.toHaveBeenCalled();
    });

    test('middleware receives request object with event and context', async () => {
      let capturedRequest: EventRequest | undefined;

      async function middleware(request: EventRequest, next: EventNext): Promise<unknown> {
        capturedRequest = request;
        return next(request);
      }

      const matcher = createEventMatcher({ middleware: [middleware] });
      matcher.route(defineEventRoute({ filters: {} }).handle(async () => {}));

      const event = { taskId: 'task-123' };
      const context = createMockContext();
      await matcher.handleEvent(event, context);

      expect(capturedRequest).toEqual({ event, context });
    });

    test('middleware receives validated event from eventSchema', async () => {
      let capturedRequest: EventRequest | undefined;
      const eventSchema = createMockSchema();

      async function middleware(request: EventRequest, next: EventNext): Promise<unknown> {
        capturedRequest = request;
        return next(request);
      }

      const matcher = createEventMatcher({ middleware: [middleware] });
      matcher.route(defineEventRoute({ filters: {}, eventSchema }).handle(async () => {}));

      const event = { taskId: 'task-123' };
      const context = createMockContext();
      await matcher.handleEvent(event, context);

      expect(validateSchemaSpy).toHaveBeenCalledWith(event, eventSchema, expect.any(String));
      expect(capturedRequest).toEqual({ event, context });
    });

    test('does not execute middleware when schema validation fails', async () => {
      const middleware = vi.fn();

      const matcher = createEventMatcher({ middleware: [middleware] });
      matcher.route(
        defineEventRoute({
          filters: {},
          eventSchema: createMockSchema({ issues: [{ message: 'invalid event' }] }),
        }).handle(async () => {}),
      );

      await expect(matcher.handleEvent({ taskId: 'task-123' }, createMockContext())).rejects.toThrow(
        'Schema validation failed for event',
      );
      expect(middleware).not.toHaveBeenCalled();
    });

    test('executes multiple matcher-level middleware in order', async () => {
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

      const matcher = createEventMatcher({ middleware: [middlewareOne, middlewareTwo] });
      matcher.route(
        defineEventRoute({ filters: {} }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      await matcher.handleEvent({ taskId: 'task-123' }, createMockContext());

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

      matcher.route(
        defineEventRoute({
          filters: {},
          middleware: [routeMiddleware],
        }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      await matcher.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async () => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: EventRequest, _next: EventNext): Promise<unknown> {
        return undefined;
      }

      matcher.route(
        defineEventRoute({
          filters: {},
          middleware: [blockingRouteMiddleware],
        }).handle(handler),
      );

      await matcher.handleEvent({ taskId: 'task-123' }, createMockContext());

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

      matcher.route(
        defineEventRoute({
          filters: {},
          middleware: [routeMiddlewareOne, routeMiddlewareTwo],
        }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      await matcher.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });
  });

  suite('combined matcher and route middleware', () => {
    test('executes matcher middleware before route middleware', async () => {
      const callOrder: string[] = [];

      async function matcherMiddleware(request: EventRequest, next: EventNext): Promise<unknown> {
        callOrder.push('matcher-mw');
        return next(request);
      }

      async function routeMiddleware(request: EventRequest, next: EventNext): Promise<unknown> {
        callOrder.push('route-mw');
        return next(request);
      }

      const matcher = createEventMatcher({ middleware: [matcherMiddleware] });
      matcher.route(
        defineEventRoute({
          filters: {},
          middleware: [routeMiddleware],
        }).handle(async () => {
          callOrder.push('handler');
        }),
      );

      await matcher.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(callOrder).toEqual(['matcher-mw', 'route-mw', 'handler']);
    });

    test('matcher middleware short-circuit prevents route middleware from running', async () => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingMatcherMiddleware(_request: EventRequest, _next: EventNext): Promise<unknown> {
        return undefined;
      }

      const matcher = createEventMatcher({ middleware: [blockingMatcherMiddleware] });
      matcher.route(
        defineEventRoute({
          filters: {},
          middleware: [routeMiddleware],
        }).handle(handler),
      );

      await matcher.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('handler return value', () => {
    test('returns handler result from handleEvent', async () => {
      matcher.route(
        defineEventRoute({ filters: {} }).handle(async () => {
          return { orderId: 'order-123', status: 'processed' };
        }),
      );

      const result = await matcher.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(result).toEqual({ orderId: 'order-123', status: 'processed' });
    });

    test('returns handler result through middleware', async () => {
      async function middleware(request: EventRequest, next: EventNext): Promise<unknown> {
        return next(request);
      }

      const matcher = createEventMatcher({ middleware: [middleware] });
      matcher.route(
        defineEventRoute({ filters: {} }).handle(async () => {
          return 'handler-result';
        }),
      );

      const result = await matcher.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(result).toBe('handler-result');
    });

    test('middleware can transform the handler return value', async () => {
      async function middleware(request: EventRequest, next: EventNext): Promise<unknown> {
        const result = await next(request);
        return { wrapped: result };
      }

      const matcher = createEventMatcher({ middleware: [middleware] });
      matcher.route(
        defineEventRoute({ filters: {} }).handle(async () => {
          return 'original';
        }),
      );

      const result = await matcher.handleEvent({ taskId: 'task-123' }, createMockContext());

      expect(result).toEqual({ wrapped: 'original' });
    });
  });
});

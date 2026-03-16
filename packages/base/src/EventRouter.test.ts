import type { Schema } from '@lambda-event-router/base';
import { createMockContext } from '@lambda-event-router/testing';
import { createEventRouter, defineEventRoute, EventRouter } from './EventRouter.js';
import type { EventFilterInput } from './eventRouterTypes.js';

suite('EventRouter', () => {
  suite('createEventRouter', () => {
    test('creates an EventRouter instance', () => {
      const router = createEventRouter();
      expect(router).toBeInstanceOf(EventRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns false for null', () => {
      const router = createEventRouter();
      expect(router.canHandleEvent(null)).toBe(false);
    });

    test('returns false for a string', () => {
      const router = createEventRouter();
      expect(router.canHandleEvent('not an event')).toBe(false);
    });

    test('returns false for a known SQS event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:sqs' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known SNS event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ EventSource: 'aws:sns' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known S3 event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:s3' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known DynamoDB Stream event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:dynamodb' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Kinesis event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:kinesis' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known API Gateway V2 event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { rawPath: '/test', requestContext: { http: { method: 'GET' } } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Cognito event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { triggerSource: 'PreSignUp_SignUp', userPoolId: 'us-east-1_TestPool' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known CodeCommit event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:codecommit' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known SES event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:ses' }] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known DocumentDB event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:docdb', events: [] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known ActiveMQ event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:mq', messages: [] };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known RabbitMQ event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:rmq', rmqMessagesByQueue: {} };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known ALB event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { requestContext: { elb: { targetGroupArn: 'arn:aws:elasticloadbalancing:...' } } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known API Gateway V1 event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { httpMethod: 'GET', requestContext: { accountId: '123' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known VPC Lattice V1 event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { raw_path: '/test', method: 'GET' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known VPC Lattice V2 event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { requestContext: { serviceArn: 'arn:aws:vpc-lattice:...' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known AppSync resolver event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { info: { parentTypeName: 'Query', fieldName: 'getItem' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known AppSync channel event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { info: { channel: '/default/test' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known AppSync Authorizer event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { authorizationToken: 'Bearer token', requestContext: { apiId: 'abc123' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known CloudWatch Logs event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { awslogs: { data: 'base64data' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known CodePipeline event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { 'CodePipeline.job': { id: 'job-123' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Config event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { invokingEvent: '{}', configRuleName: 'my-rule' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Connect event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Name: 'ContactFlowEvent' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Lex event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { sessionState: { intent: {} }, bot: { name: 'my-bot' } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Secrets Manager event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { SecretId: 'arn:aws:secretsmanager:...', Step: 'createSecret' };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns true for an arbitrary object when a catch-all route is registered', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      expect(router.canHandleEvent({ taskId: 'task-123' })).toBe(true);
    });

    test('returns false for a known Kafka (MSK) event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'aws:kafka', bootstrapServers: 'b-1.demo:9092', records: { 'topic-1-0': [] } };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known self-managed Kafka event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = {
        eventSource: 'SelfManagedKafka',
        bootstrapServers: 'b-1.demo:9092',
        records: { 'topic-1-0': [] },
      };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known Firehose event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = {
        invocationId: 'invocation-123',
        deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789012:deliverystream/my-stream',
        region: 'us-east-1',
        records: [{ recordId: 'record-1', data: 'base64data' }],
      };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for a known S3 Batch event', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = {
        invocationSchemaVersion: '1.0',
        invocationId: 'invocation-123',
        job: { id: 'job-123' },
        tasks: [{ taskId: 'task-1', s3Key: 'key', s3BucketArn: 'arn:aws:s3:::bucket' }],
      };
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false for an EventBridge envelope event', () => {
      const router = createEventRouter();
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
      expect(router.canHandleEvent(event)).toBe(false);
    });

    test('returns false when no routes are registered', () => {
      const router = createEventRouter();
      expect(router.canHandleEvent({ taskId: 'task-123' })).toBe(false);
    });

    test('returns false when no routes match via customFilter', () => {
      const router = createEventRouter();
      router.route(
        defineEventRoute({
          filters: { customFilter: () => false },
        }).handle(async () => {}),
      );
      expect(router.canHandleEvent({ taskId: 'task-123' })).toBe(false);
    });

    test('returns true when a customFilter matches', () => {
      const router = createEventRouter();
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
      expect(router.canHandleEvent({ taskId: 'task-123' })).toBe(true);
    });

    test('returns true for Records array with non-object first element when route matches', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [42] };
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for Records array with unknown eventSource when route matches', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { Records: [{ eventSource: 'aws:unknown' }] };
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for unknown top-level eventSource string when route matches', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { eventSource: 'custom:unknown' };
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for requestContext without serviceArn or full AppSync Authorizer shape when route matches', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { requestContext: { apiId: 'abc123' } };
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for info object without parentTypeName or channel when route matches', () => {
      const router = createEventRouter();
      router.route(defineEventRoute({ filters: {} }).handle(async () => {}));
      const event = { info: { someOtherField: 'value' } };
      expect(router.canHandleEvent(event)).toBe(true);
    });
  });

  suite('defineEventRoute', () => {
    test('preserves filters, eventSchema, and handler', () => {
      const eventSchema: Schema<{ taskId: string }> = {
        safeParse: (data: unknown) => ({ success: true, data: data as { taskId: string } }),
      };
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
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const router = new EventRouter();
      const definition = defineEventRoute({
        filters: {},
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    let router: EventRouter;

    beforeEach(() => {
      router = createEventRouter();
    });

    test('matches route by customFilter', () => {
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
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('matches route with empty filters as catch-all', () => {
      router.route(
        defineEventRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
    });

    test('does not match when customFilter returns false', () => {
      router.route(
        defineEventRoute({
          filters: { customFilter: () => false },
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeUndefined();
    });

    test('passes correct filterInput to customFilter', () => {
      const customFilter = vi.fn().mockReturnValue(true);

      router.route(
        defineEventRoute({
          filters: { customFilter },
        }).handle(async () => {}),
      );

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      router.matchRoute(event);

      expect(customFilter).toHaveBeenCalledWith({ event });
    });

    test('selects the first matching route when multiple routes match', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.route(defineEventRoute({ filters: {} }).handle(firstHandler));
      router.route(defineEventRoute({ filters: {} }).handle(secondHandler));

      const event = { taskId: 'task-123' };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(event);

      expect(result).toBeDefined();
      // @ts-expect-error - result is asserted as defined above
      expect(result.handler).toBe(firstHandler);
    });
  });

  suite('handleEvent', () => {
    test('calls handler with request object containing event and context', async () => {
      const router = createEventRouter();
      const handler = vi.fn();
      const customEvent = { taskId: 'task-123', payload: 'data' };
      const context = createMockContext();

      router.route(
        defineEventRoute({
          filters: {},
          eventSchema: { safeParse: (data: unknown) => ({ success: true as const, data }) },
        }).handle(handler),
      );

      await router.handleEvent(customEvent, context);

      expect(handler).toHaveBeenCalledWith({ event: customEvent, context });
    });

    test('throws when no route matches', async () => {
      const router = createEventRouter();

      await expect(router.handleEvent({ taskId: 'task-123' }, createMockContext())).rejects.toThrow(
        'No route matched for event',
      );
    });

    test('handler receives validated event from eventSchema in request object', async () => {
      const router = createEventRouter();
      const handler = vi.fn();
      const transformedEvent = { taskId: 'task-123', validated: true };
      const eventSchema: Schema<typeof transformedEvent> = {
        safeParse: () => ({ success: true, data: transformedEvent }),
      };
      const context = createMockContext();

      router.route(
        defineEventRoute({
          filters: {},
          eventSchema,
        }).handle(handler),
      );

      await router.handleEvent({ taskId: 'task-123' }, context);

      expect(handler).toHaveBeenCalledWith({ event: transformedEvent, context });
    });

    test('throws when eventSchema validation fails', async () => {
      const router = createEventRouter();
      const eventSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid event') }),
      };

      router.route(
        defineEventRoute({
          filters: {},
          eventSchema,
        }).handle(async () => {}),
      );

      await expect(router.handleEvent({ taskId: 'task-123' }, createMockContext())).rejects.toThrow(
        'Event validation failed',
      );
    });
  });

  suite('validateSchema', () => {
    let router: EventRouter;

    beforeEach(() => {
      router = new EventRouter();
    });

    test('returns data unchanged when no schema is provided', () => {
      const data = { taskId: 'task-123' };

      // @ts-expect-error - testing private method directly
      const result = router.validateSchema(data, undefined, 'Error context');

      expect(result).toBe(data);
    });

    test('returns validated data when schema succeeds', () => {
      const data = { taskId: 'task-123' };
      const transformedData = { taskId: 'task-123', validated: true };
      const schema: Schema<typeof transformedData> = {
        safeParse: () => ({ success: true, data: transformedData }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateSchema(data, schema, 'Error context');

      expect(result).toEqual(transformedData);
    });

    test('throws with error context when schema fails', () => {
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid data') }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateSchema({}, schema, 'Event validation failed')).toThrow('Event validation failed');
    });
  });
});

import { createCloudWatchLogsEvent, test } from '@lambda-event-router/testing';
import type { CloudWatchLogsDecodedData } from 'aws-lambda';
import { CloudWatchLogsRouter, createCloudWatchLogsRouter, defineRoute } from './CloudWatchRouter.js';

suite('CloudWatchLogsRouter', () => {
  suite('createCloudWatchLogsRouter', () => {
    test('creates a CloudWatchLogsRouter instance', () => {
      const router = createCloudWatchLogsRouter();
      expect(router).toBeInstanceOf(CloudWatchLogsRouter);
    });
  });

  suite('canHandleEvent', () => {
    let router: CloudWatchLogsRouter;

    beforeEach(() => {
      router = new CloudWatchLogsRouter();
    });

    test('returns true for a valid CloudWatch Logs event', () => {
      const event = createCloudWatchLogsEvent();
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns false for a non-CloudWatch event', () => {
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
        filters: { logGroups: ['/aws/lambda/my-function'] },
      });

      expect(builder).toHaveProperty('handle');
      expect(typeof builder.handle).toBe('function');
    });

    test('preserves filters and handler in the definition', () => {
      const handler = vi.fn();
      const filters = {
        logGroups: ['/aws/lambda/my-function'],
        messageTypes: ['DATA_MESSAGE' as const],
      };

      const definition = defineRoute({ filters }).handle(handler);

      expect(definition).toEqual({ filters, handler });
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const router = new CloudWatchLogsRouter();
      const definition = defineRoute({
        filters: { logGroups: ['/aws/lambda/my-function'] },
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('dataMessage', () => {
    test('returns the router instance for chaining', () => {
      const router = new CloudWatchLogsRouter();

      const result = router.dataMessage({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('forces messageTypes to DATA_MESSAGE in filters', () => {
      const router = new CloudWatchLogsRouter();
      const handler = vi.fn();

      router.dataMessage({ filters: { logGroups: ['/aws/lambda/my-function'] }, handler });

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute(decodedData);
      expect(matched).toBeDefined();

      const controlData: CloudWatchLogsDecodedData = {
        ...decodedData,
        messageType: 'CONTROL_MESSAGE',
      };
      // @ts-expect-error - testing private method directly
      const notMatched = router.matchRoute(controlData);
      expect(notMatched).toBeUndefined();
    });
  });

  suite('controlMessage', () => {
    test('returns the router instance for chaining', () => {
      const router = new CloudWatchLogsRouter();

      const result = router.controlMessage({
        filters: {},
        handler: async () => {},
      });

      expect(result).toBe(router);
    });

    test('forces messageTypes to CONTROL_MESSAGE in filters', () => {
      const router = new CloudWatchLogsRouter();
      const handler = vi.fn();

      router.controlMessage({ filters: { logGroups: ['/aws/lambda/my-function'] }, handler });

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'CONTROL_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const matched = router.matchRoute(decodedData);
      expect(matched).toBeDefined();

      const dataMsg: CloudWatchLogsDecodedData = {
        ...decodedData,
        messageType: 'DATA_MESSAGE',
      };
      // @ts-expect-error - testing private method directly
      const notMatched = router.matchRoute(dataMsg);
      expect(notMatched).toBeUndefined();
    });
  });

  suite('decodeLogData', () => {
    test('decodes base64 + gzip compressed log data', () => {
      const router = new CloudWatchLogsRouter();
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
      const router = new CloudWatchLogsRouter();
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
    let router: CloudWatchLogsRouter;

    beforeEach(() => {
      router = createCloudWatchLogsRouter();
    });

    test('matches route by messageTypes', () => {
      router.route(
        defineRoute({
          filters: { messageTypes: ['DATA_MESSAGE'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when messageTypes does not match', () => {
      router.route(
        defineRoute({
          filters: { messageTypes: ['CONTROL_MESSAGE'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches route by logGroups', () => {
      router.route(
        defineRoute({
          filters: { logGroups: ['/aws/lambda/my-function'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when logGroups does not match', () => {
      router.route(
        defineRoute({
          filters: { logGroups: ['/aws/lambda/other-function'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches route by logGroupPrefixes', () => {
      router.route(
        defineRoute({
          filters: { logGroupPrefixes: ['/aws/lambda/'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when logGroupPrefixes does not match', () => {
      router.route(
        defineRoute({
          filters: { logGroupPrefixes: ['/aws/ecs/'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches route by logGroupSuffixes', () => {
      router.route(
        defineRoute({
          filters: { logGroupSuffixes: ['my-function'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when logGroupSuffixes does not match', () => {
      router.route(
        defineRoute({
          filters: { logGroupSuffixes: ['other-function'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches route by logGroupIncludes', () => {
      router.route(
        defineRoute({
          filters: { logGroupIncludes: ['lambda'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when logGroupIncludes does not match', () => {
      router.route(
        defineRoute({
          filters: { logGroupIncludes: ['ecs'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches route by subscriptionFilters', () => {
      router.route(
        defineRoute({
          filters: { subscriptionFilters: ['my-filter'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when subscriptionFilters does not match', () => {
      router.route(
        defineRoute({
          filters: { subscriptionFilters: ['other-filter'] },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches route by customFilter', () => {
      router.route(
        defineRoute({
          filters: {
            customFilter: (input: CloudWatchLogsDecodedData): boolean => {
              return input.owner === '123456789012';
            },
          },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when customFilter returns false', () => {
      router.route(
        defineRoute({
          filters: { customFilter: (): boolean => false },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });

    test('matches with empty filters as catch-all', () => {
      router.route(
        defineRoute({
          filters: {},
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('selects first matching route when multiple match', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.route(
        defineRoute({
          filters: { logGroups: ['/aws/lambda/my-function'] },
        }).handle(firstHandler),
      );
      router.route(
        defineRoute({
          filters: { logGroups: ['/aws/lambda/my-function'] },
        }).handle(secondHandler),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeDefined();
      // @ts-expect-error - result is asserted as defined above
      expect(result.handler).toBe(firstHandler);
    });

    test('matches when multiple filter types all match', () => {
      router.route(
        defineRoute({
          filters: {
            logGroups: ['/aws/lambda/my-function'],
            messageTypes: ['DATA_MESSAGE'],
            subscriptionFilters: ['my-filter'],
          },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeDefined();
    });

    test('does not match when one filter type fails but others match', () => {
      router.route(
        defineRoute({
          filters: {
            logGroups: ['/aws/lambda/my-function'],
            messageTypes: ['CONTROL_MESSAGE'],
          },
        }).handle(async () => {}),
      );

      const decodedData: CloudWatchLogsDecodedData = {
        owner: '123456789012',
        logGroup: '/aws/lambda/my-function',
        logStream: '2024/01/01/[$LATEST]abc123',
        subscriptionFilters: ['my-filter'],
        messageType: 'DATA_MESSAGE',
        logEvents: [],
      };
      // @ts-expect-error - testing private method directly
      const result = router.matchRoute(decodedData);

      expect(result).toBeUndefined();
    });
  });

  suite('handleEvent', () => {
    test('calls the matched handler with decoded data and context', async ({ cloudWatchLogsHandlerEvent }) => {
      const router = new CloudWatchLogsRouter();
      const handler = vi.fn();
      router.route(
        defineRoute({
          filters: { logGroups: ['/aws/lambda/my-function'] },
        }).handle(handler),
      );

      const { event, context } = cloudWatchLogsHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).toHaveBeenCalledOnce();
    });

    test('throws when no route matches', async ({ cloudWatchLogsHandlerEvent }) => {
      const router = createCloudWatchLogsRouter();

      const { event, context } = cloudWatchLogsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('No route matched');
    });

    test('propagates handler errors', async ({ cloudWatchLogsHandlerEvent }) => {
      const router = createCloudWatchLogsRouter();
      router.route(
        defineRoute({ filters: {} }).handle(async () => {
          throw new Error('handler exploded');
        }),
      );

      const { event, context } = cloudWatchLogsHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('handler exploded');
    });

    test('verifies the request shape', async ({ context }) => {
      const router = new CloudWatchLogsRouter();
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

      const router = createCloudWatchLogsRouter();
      router.route(
        defineRoute({
          filters: { logGroupPrefixes: ['/aws/lambda/'] },
        }).handle(lambdaHandler),
      );
      router.route(
        defineRoute({
          filters: { logGroupPrefixes: ['/aws/ecs/'] },
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
});

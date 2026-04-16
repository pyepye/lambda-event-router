import * as base from '@lambda-event-router/base';
import {
  createConfigurationItem,
  createConfigurationItemSummary,
  createMockSchema,
  test,
} from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
import { ConfigRouter, createConfigRouter, defineRoute } from './ConfigRouter.js';
import type { ConfigOversizedRequest, ConfigRequest } from './configRouterTypes.js';

type ConfigRequestUnion = ConfigRequest | ConfigOversizedRequest;
type ConfigNext = (request: ConfigRequestUnion) => Promise<void>;

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');

suite('ConfigRouter', () => {
  let router: ConfigRouter;

  beforeEach(() => {
    router = new ConfigRouter();
  });

  suite('createConfigRouter', () => {
    test('creates a ConfigRouter instance', () => {
      const router = createConfigRouter();
      expect(router).toBeInstanceOf(ConfigRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns false for non-object events', () => {
      expect(router.canHandleEvent(null)).toBe(false);
      expect(router.canHandleEvent(undefined)).toBe(false);
      expect(router.canHandleEvent('not an event')).toBe(false);
      expect(router.canHandleEvent(42)).toBe(false);
    });

    test('returns false when required fields are not strings', () => {
      expect(router.canHandleEvent({ invokingEvent: 123, configRuleName: 'rule', resultToken: 'token' })).toBe(false);
      expect(router.canHandleEvent({ invokingEvent: '{}', configRuleName: 123, resultToken: 'token' })).toBe(false);
      expect(router.canHandleEvent({ invokingEvent: '{}', configRuleName: 'rule', resultToken: 123 })).toBe(false);
    });

    test('returns false when invokingEvent is invalid JSON', () => {
      expect(router.canHandleEvent({ invokingEvent: 'not-json', configRuleName: 'rule', resultToken: 'token' })).toBe(
        false,
      );
    });

    test('returns false when parsed invokingEvent is not an object', () => {
      expect(router.canHandleEvent({ invokingEvent: '"a string"', configRuleName: 'rule', resultToken: 'token' })).toBe(
        false,
      );
    });

    test('returns false when messageType is ScheduledNotification', () => {
      const invokingEvent = JSON.stringify({ messageType: 'ScheduledNotification' });
      expect(router.canHandleEvent({ invokingEvent, configRuleName: 'rule', resultToken: 'token' })).toBe(false);
    });

    test('returns true for ConfigurationItemChangeNotification', ({ configEvent }) => {
      const event = configEvent({ invokingEvent: { messageType: 'ConfigurationItemChangeNotification' } });
      expect(router.canHandleEvent(event)).toBe(true);
    });

    test('returns true for OversizedConfigurationItemChangeNotification', ({ configEvent }) => {
      const event = configEvent({
        invokingEvent: {
          messageType: 'OversizedConfigurationItemChangeNotification',
          configurationItemSummary: createConfigurationItemSummary(),
        },
      });
      expect(router.canHandleEvent(event)).toBe(true);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineRoute({
        filters: {},
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });

    test('adds multiple routes', () => {
      const definitionA = defineRoute({ filters: { configRuleName: 'rule-a' } }).handle(async () => {});
      const definitionB = defineRoute({ filters: { configRuleName: 'rule-b' } }).handle(async () => {});

      router.route(definitionA).route(definitionB);

      // @ts-expect-error - testing private method directly
      const matchA = router.matchRoute({ configRuleName: 'rule-a' });
      // @ts-expect-error - testing private method directly
      const matchB = router.matchRoute({ configRuleName: 'rule-b' });

      expect(matchA).toBeDefined();
      expect(matchB).toBeDefined();
    });
  });

  suite('matchRoute', () => {
    test('matches when no filters set', () => {
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'any-rule' });

      expect(result).toBeDefined();
    });

    test('matches by configRuleName filter', () => {
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeDefined();
    });

    test('matches by configRuleName filter array', () => {
      router.route(defineRoute({ filters: { configRuleName: ['my-rule', 'other-rule'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeDefined();
    });

    test('rejects when configRuleName not in filter', () => {
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'other-rule' });

      expect(result).toBeUndefined();
    });

    test('matches by resourceType filter', () => {
      router.route(defineRoute({ filters: { resourceType: 'AWS::EC2::Instance' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceType: 'AWS::EC2::Instance' });

      expect(result).toBeDefined();
    });

    test('matches by resourceType filter array', () => {
      router.route(
        defineRoute({ filters: { resourceType: ['AWS::EC2::Instance', 'AWS::EC2::Other'] } }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceType: 'AWS::EC2::Instance' });

      expect(result).toBeDefined();
    });

    test('rejects when resourceType not in filter', () => {
      router.route(defineRoute({ filters: { resourceType: 'AWS::EC2::Instance' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceType: 'AWS::S3::Bucket' });

      expect(result).toBeUndefined();
    });

    test('skips resourceType filter when resourceType is undefined', () => {
      router.route(defineRoute({ filters: { resourceType: 'AWS::EC2::Instance' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceType: undefined });

      expect(result).toBeDefined();
    });

    test('matches by resourceId filter', () => {
      router.route(defineRoute({ filters: { resourceId: 'i-abc123' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceId: 'i-abc123' });

      expect(result).toBeDefined();
    });

    test('matches by resourceId filter array', () => {
      router.route(defineRoute({ filters: { resourceId: ['i-abc123', 'i-xyz789'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceId: 'i-abc123' });

      expect(result).toBeDefined();
    });

    test('rejects when resourceId not in filter', () => {
      router.route(defineRoute({ filters: { resourceId: 'i-abc123' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceId: 'i-other' });

      expect(result).toBeUndefined();
    });

    test('skips resourceId filter when resourceId is undefined', () => {
      router.route(defineRoute({ filters: { resourceId: 'i-abc123' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceId: undefined });

      expect(result).toBeDefined();
    });

    test('matches by configurationItemStatus filter', () => {
      router.route(defineRoute({ filters: { configurationItemStatus: 'ResourceDiscovered' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({
        configRuleName: 'rule',
        configurationItemStatus: 'ResourceDiscovered',
      });

      expect(result).toBeDefined();
    });

    test('matches by configurationItemStatus filter array', () => {
      router.route(
        defineRoute({ filters: { configurationItemStatus: ['ResourceDiscovered', 'ResourceUpdated'] } }).handle(
          async () => {},
        ),
      );

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({
        configRuleName: 'rule',
        configurationItemStatus: 'ResourceDiscovered',
      });

      expect(result).toBeDefined();
    });

    test('rejects when configurationItemStatus not in filter', () => {
      router.route(defineRoute({ filters: { configurationItemStatus: 'ResourceDiscovered' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', configurationItemStatus: 'ResourceDeleted' });

      expect(result).toBeUndefined();
    });

    test('skips configurationItemStatus filter when status is undefined', () => {
      router.route(defineRoute({ filters: { configurationItemStatus: 'ResourceDiscovered' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', configurationItemStatus: undefined });

      expect(result).toBeDefined();
    });

    test('multiple filters combined - all must match', () => {
      router.route(
        defineRoute({
          filters: {
            configRuleName: 'my-rule',
            resourceType: 'AWS::EC2::Instance',
            resourceId: 'i-abc123',
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({
        configRuleName: 'my-rule',
        resourceType: 'AWS::EC2::Instance',
        resourceId: 'i-abc123',
      });

      expect(result).toBeDefined();
    });

    test('returns undefined when no routes match', () => {
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'nonexistent-rule' });

      expect(result).toBeUndefined();
    });

    test('returns first matching route when multiple routes exist', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(firstHandler));
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(secondHandler));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });
  });

  suite('handleEvent', () => {
    test('normal change notification calls handler with correct fields', async ({ configEvent, context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const configItem = createConfigurationItem();
      const event = configEvent({
        invokingEvent: {
          messageType: 'ConfigurationItemChangeNotification',
          configurationItem: configItem,
        },
        resultToken: 'my-token',
        configRuleName: 'my-rule',
      });
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          configurationItem: expect.objectContaining({ resourceType: configItem.resourceType }),
          configurationItemSummary: undefined,
          resultToken: 'my-token',
          configRuleName: 'my-rule',
          event,
          context: mockContext,
        }),
      );
    });

    test('uconfig configurationItem.configuration when no schema and configuration is undefined', async ({
      configEvent,
      context,
    }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const configItem = createConfigurationItem({ configuration: undefined });
      const event = configEvent({
        invokingEvent: {
          messageType: 'ConfigurationItemChangeNotification',
          configurationItem: configItem,
        },
      });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          configurationItem: expect.objectContaining({ configuration: undefined }),
        }),
      );
    });

    test('oversized notification calls handler with ConfigOversizedRequest containing configurationItemSummary', async ({
      configEvent,
      context,
    }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const summary = createConfigurationItemSummary();
      const event = configEvent({
        invokingEvent: {
          messageType: 'OversizedConfigurationItemChangeNotification',
          configurationItemSummary: summary,
        },
      });
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          configurationItemSummary: expect.objectContaining({ resourceType: summary.resourceType }),
          configurationItem: undefined,
          resultToken: event.resultToken,
          configRuleName: event.configRuleName,
          event,
          context: mockContext,
        }),
      );
    });

    test('parconfig ruleParameters from JSON string', async ({ configEvent, context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = configEvent({ ruleParameters: { env: 'prod', region: 'us-east-1' } });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ ruleParameters: { env: 'prod', region: 'us-east-1' } }),
      );
    });

    test('defaults ruleParameters to empty object when empty string', async ({ configEvent, context }) => {
      const handler = vi.fn();
      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = configEvent();
      const modifiedEvent = { ...event, ruleParameters: '' };
      await router.handleEvent(modifiedEvent, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ ruleParameters: {} }));
    });

    test('throws when no route matches', async ({ configEvent, context }) => {
      router.route(defineRoute({ filters: { configRuleName: 'specific-rule' } }).handle(async () => {}));

      const event = configEvent({ configRuleName: 'unknown-rule' });
      await expect(router.handleEvent(event, context())).rejects.toThrow(
        'No route matched for config rule unknown-rule',
      );
    });

    test('validates ruleParameters schema when provided', async ({ configEvent, context }) => {
      const handler = vi.fn();
      const ruleParametersSchema = createMockSchema();
      router.route(defineRoute({ filters: {}, ruleParametersSchema }).handle(handler));

      const event = configEvent({ ruleParameters: { env: 'prod' } });
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith({ env: 'prod' }, ruleParametersSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ ruleParameters: { env: 'prod' } }));
    });

    test('throws when ruleParameters schema validation fails', async ({ configEvent, context }) => {
      const ruleParametersSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.route(defineRoute({ filters: {}, ruleParametersSchema }).handle(async () => {}));

      const event = configEvent({ ruleParameters: { bad: 'data' } });
      await expect(router.handleEvent(event, context())).rejects.toThrow('Schema validation failed for ruleParameters');
    });

    test('validates configuration schema for normal events', async ({ configEvent, context }) => {
      const handler = vi.fn();
      const configurationSchema = createMockSchema();
      router.route(defineRoute({ filters: {}, configurationSchema }).handle(handler));

      const configurationItem = createConfigurationItem({
        configuration: { instanceType: 't2.micro' },
      });
      const event = configEvent({
        invokingEvent: { configurationItem },
      });
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith(
        configurationItem.configuration,
        configurationSchema,
        expect.any(String),
      );
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          configurationItem: expect.objectContaining({
            configuration: configurationItem.configuration,
          }),
        }),
      );
    });

    test('throws when configuration schema validation fails', async ({ configEvent, context }) => {
      const configurationSchema = createMockSchema({ issues: [{ message: 'invalid config' }] });
      router.route(defineRoute({ filters: {}, configurationSchema }).handle(async () => {}));

      const event = configEvent({
        invokingEvent: {
          configurationItem: createConfigurationItem({
            configuration: { bad: 'config' },
          }),
        },
      });
      await expect(router.handleEvent(event, context())).rejects.toThrow('Schema validation failed for configuration');
    });

    test('skips configuration schema validation for oversized events', async ({ configEvent, context }) => {
      const handler = vi.fn();
      const configurationSchema = createMockSchema({ issues: [{ message: 'should not be called' }] });
      router.route(defineRoute({ filters: {}, configurationSchema }).handle(handler));

      const event = configEvent({
        invokingEvent: {
          messageType: 'OversizedConfigurationItemChangeNotification',
          configurationItemSummary: createConfigurationItemSummary(),
        },
      });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ configurationItem: undefined }));
    });
  });

  suite('defineRoute', () => {
    test('returns builder with handle method', () => {
      const builder = defineRoute({ filters: { configRuleName: 'my-rule' } });
      expect(builder).toHaveProperty('handle');
      expect(builder.handle).toBeTypeOf('function');
    });

    test('preserves filters, schemas, and handler in the definition', () => {
      const handler = vi.fn();
      const ruleParametersSchema = createMockSchema();
      const configurationSchema = createMockSchema();

      const filters = { configRuleName: 'my-rule', resourceType: 'AWS::EC2::Instance' };
      const definition = defineRoute({ filters, ruleParametersSchema, configurationSchema }).handle(handler);

      expect(definition.filters).toEqual(filters);
      expect(definition.ruleParametersSchema).toBe(ruleParametersSchema);
      expect(definition.configurationSchema).toBe(configurationSchema);
      expect(definition.handler).toBe(handler);
    });
  });

  suite('router-level middleware', () => {
    test('executes middleware before the route handler', async ({ configHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middleware(request: ConfigRequestUnion, next: ConfigNext): Promise<void> {
        callOrder.push('mw-pre');
        await next(request);
        callOrder.push('mw-post');
      }

      const router = createConfigRouter({ middleware: [middleware] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = configHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw-pre', 'handler', 'mw-post']);
    });

    test('allows middleware to skip a record by not calling next', async ({ configHandlerEvent }) => {
      const handler = vi.fn();

      async function skipMiddleware(_request: ConfigRequestUnion, _next: ConfigNext): Promise<void> {
        return;
      }

      const router = createConfigRouter({ middleware: [skipMiddleware] });
      router.route({ filters: {}, handler });

      const { event, context } = configHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple router-level middleware in order', async ({ configHandlerEvent }) => {
      const callOrder: string[] = [];

      async function middlewareOne(request: ConfigRequestUnion, next: ConfigNext): Promise<void> {
        callOrder.push('mw1');
        await next(request);
      }

      async function middlewareTwo(request: ConfigRequestUnion, next: ConfigNext): Promise<void> {
        callOrder.push('mw2');
        await next(request);
      }

      const router = createConfigRouter({ middleware: [middlewareOne, middlewareTwo] });
      router.route({
        filters: {},
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = configHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['mw1', 'mw2', 'handler']);
    });
  });

  suite('route-level middleware', () => {
    test('executes route-level middleware for a specific route', async ({ configHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: ConfigRequestUnion, next: ConfigNext): Promise<void> {
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

      const { event, context } = configHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });

    test('allows route-level middleware to short-circuit by not calling next', async ({ configHandlerEvent }) => {
      const handler = vi.fn();

      async function blockingRouteMiddleware(_request: ConfigRequestUnion, _next: ConfigNext): Promise<void> {
        return;
      }

      router.route({ filters: {}, middleware: [blockingRouteMiddleware], handler });

      const { event, context } = configHandlerEvent();
      await router.handleEvent(event, context);

      expect(handler).not.toHaveBeenCalled();
    });

    test('executes multiple route-level middleware in order', async ({ configHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddlewareOne(request: ConfigRequestUnion, next: ConfigNext): Promise<void> {
        callOrder.push('route-mw1');
        await next(request);
      }

      async function routeMiddlewareTwo(request: ConfigRequestUnion, next: ConfigNext): Promise<void> {
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

      const { event, context } = configHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw1', 'route-mw2', 'handler']);
    });

    test('supports middleware on defineRoute builder pattern', async ({ configHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routeMiddleware(request: ConfigRequestUnion, next: ConfigNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const route = defineRoute({ filters: {}, middleware: [routeMiddleware] }).handle(async () => {
        callOrder.push('handler');
      });

      router.route(route);

      const { event, context } = configHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['route-mw', 'handler']);
    });
  });

  suite('combined router and route middleware', () => {
    test('executes router middleware before route middleware', async ({ configHandlerEvent }) => {
      const callOrder: string[] = [];

      async function routerMiddleware(request: ConfigRequestUnion, next: ConfigNext): Promise<void> {
        callOrder.push('router-mw');
        await next(request);
      }

      async function routeMiddleware(request: ConfigRequestUnion, next: ConfigNext): Promise<void> {
        callOrder.push('route-mw');
        await next(request);
      }

      const router = createConfigRouter({ middleware: [routerMiddleware] });
      router.route({
        filters: {},
        middleware: [routeMiddleware],
        handler: async () => {
          callOrder.push('handler');
        },
      });

      const { event, context } = configHandlerEvent();
      await router.handleEvent(event, context);

      expect(callOrder).toEqual(['router-mw', 'route-mw', 'handler']);
    });

    test('router middleware short-circuit prevents route middleware from running', async ({ configHandlerEvent }) => {
      const routeMiddleware = vi.fn();
      const handler = vi.fn();

      async function blockingRouterMiddleware(_request: ConfigRequestUnion, _next: ConfigNext): Promise<void> {
        return;
      }

      const router = createConfigRouter({ middleware: [blockingRouterMiddleware] });
      router.route({ filters: {}, middleware: [routeMiddleware], handler });

      const { event, context } = configHandlerEvent();
      await router.handleEvent(event, context);

      expect(routeMiddleware).not.toHaveBeenCalled();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  suite('middleware does not run on validation failure', () => {
    test('does not execute middleware when schema validation fails', async ({ configHandlerEvent }) => {
      const middleware = vi.fn();
      const ruleParametersSchema = createMockSchema({ issues: [{ message: 'invalid' }] });

      const router = createConfigRouter({ middleware: [middleware] });
      router.route({ filters: {}, ruleParametersSchema, handler: vi.fn() });

      const { event, context } = configHandlerEvent();
      await expect(router.handleEvent(event, context)).rejects.toThrow('Schema validation failed for ruleParameters');
      expect(middleware).not.toHaveBeenCalled();
    });
  });
});

import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { MockInstance } from 'vitest';

import * as base from '@lambda-event-router/base';
import {
  allEventBuilders,
  createConfigurationItem,
  createConfigurationItemSummary,
  createMockSchema,
  test,
} from '@lambda-event-router/testing';

import type { ConfigEvent } from '../types.js';
import { ConfigRouter, createConfigRouter, defineRoute } from './ConfigRouter.js';
import type {
  ConfigChangeFilterInput,
  ConfigOversizedRequest,
  ConfigRequest,
  ConfigurationItem,
  ConfigurationItemSummary,
} from './types.js';

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

    test('adds multiple routes', async () => {
      const definitionA = defineRoute({ filters: { configRuleName: 'rule-a' } }).handle(async () => {});
      const definitionB = defineRoute({ filters: { configRuleName: 'rule-b' } }).handle(async () => {});

      router.route(definitionA).route(definitionB);

      // @ts-expect-error - testing private method directly
      const matchA = await router.matchRoute({ configRuleName: 'rule-a' });
      // @ts-expect-error - testing private method directly
      const matchB = await router.matchRoute({ configRuleName: 'rule-b' });

      expect(matchA).toBeDefined();
      expect(matchB).toBeDefined();
    });
  });

  suite('matchRoute', () => {
    test('matches when no filters set', async () => {
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'any-rule' });

      expect(result).toBeDefined();
    });

    test('matches by configRuleName filter', async () => {
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeDefined();
    });

    test('does not match when configRuleName is an empty string', async () => {
      router.route(defineRoute({ filters: { configRuleName: '' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeUndefined();
    });

    test('matches by configRuleName filter array', async () => {
      router.route(defineRoute({ filters: { configRuleName: ['my-rule', 'other-rule'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeDefined();
    });

    test('rejects when configRuleName not in filter', async () => {
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'other-rule' });

      expect(result).toBeUndefined();
    });

    test('matches by resourceType filter', async () => {
      router.route(defineRoute({ filters: { resourceType: 'AWS::EC2::Instance' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'rule', resourceType: 'AWS::EC2::Instance' });

      expect(result).toBeDefined();
    });

    test('matches by resourceType filter array', async () => {
      router.route(
        defineRoute({ filters: { resourceType: ['AWS::EC2::Instance', 'AWS::EC2::Other'] } }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'rule', resourceType: 'AWS::EC2::Instance' });

      expect(result).toBeDefined();
    });

    test('rejects when resourceType not in filter', async () => {
      router.route(defineRoute({ filters: { resourceType: 'AWS::EC2::Instance' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'rule', resourceType: 'AWS::S3::Bucket' });

      expect(result).toBeUndefined();
    });

    test('matches by resourceId filter', async () => {
      router.route(defineRoute({ filters: { resourceId: 'i-abc123' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'rule', resourceId: 'i-abc123' });

      expect(result).toBeDefined();
    });

    test('matches by resourceId filter array', async () => {
      router.route(defineRoute({ filters: { resourceId: ['i-abc123', 'i-xyz789'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'rule', resourceId: 'i-abc123' });

      expect(result).toBeDefined();
    });

    test('rejects when resourceId not in filter', async () => {
      router.route(defineRoute({ filters: { resourceId: 'i-abc123' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'rule', resourceId: 'i-other' });

      expect(result).toBeUndefined();
    });

    test('matches by configurationItemStatus filter', async () => {
      router.route(defineRoute({ filters: { configurationItemStatus: 'ResourceDiscovered' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({
        configRuleName: 'rule',
        configurationItemStatus: 'ResourceDiscovered',
      });

      expect(result).toBeDefined();
    });

    test('matches by configurationItemStatus filter array', async () => {
      router.route(
        defineRoute({ filters: { configurationItemStatus: ['ResourceDiscovered', 'ResourceUpdated'] } }).handle(
          async () => {},
        ),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({
        configRuleName: 'rule',
        configurationItemStatus: 'ResourceDiscovered',
      });

      expect(result).toBeDefined();
    });

    test('rejects when configurationItemStatus not in filter', async () => {
      router.route(defineRoute({ filters: { configurationItemStatus: 'ResourceDiscovered' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'rule', configurationItemStatus: 'ResourceDeleted' });

      expect(result).toBeUndefined();
    });

    test('multiple filters combined - all must match', async () => {
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
      const result = await router.matchRoute({
        configRuleName: 'my-rule',
        resourceType: 'AWS::EC2::Instance',
        resourceId: 'i-abc123',
      });

      expect(result).toBeDefined();
    });

    test('returns undefined when no routes match', async () => {
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'nonexistent-rule' });

      expect(result).toBeUndefined();
    });

    test('returns first matching route when multiple routes exist', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(firstHandler));
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(secondHandler));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeDefined();
      expect(result?.handler).toBe(firstHandler);
    });

    test('orders a narrower route ahead of a broader one registered first', async () => {
      const broad = vi.fn();
      const narrow = vi.fn();
      router.route(defineRoute({ filters: { configRuleName: 'my-*' } }).handle(broad));
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(narrow));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule' });

      expect(result?.handler).toBe(narrow);
    });

    test('orders a guarded route ahead of the fallback it shares filters with', async () => {
      const fallback = vi.fn();
      const guarded = vi.fn();
      router.route(defineRoute({ filters: { configRuleName: 'my-rule' } }).handle(fallback));
      router.route(defineRoute({ filters: { configRuleName: 'my-rule', custom: () => true } }).handle(guarded));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule' });

      expect(result?.handler).toBe(guarded);
    });

    test('matches route by custom', async () => {
      router.route(
        defineRoute({
          filters: {
            custom: ({ configRuleName }: ConfigChangeFilterInput): boolean => configRuleName === 'my-rule',
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeDefined();
    });

    test('does not match route when custom returns false', async () => {
      router.route(
        defineRoute({
          filters: {
            custom: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'any-rule' });

      expect(result).toBeUndefined();
    });

    test('passes correct filterInput to custom', async () => {
      const custom = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: { custom },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      await router.matchRoute({
        configRuleName: 'my-rule',
        resourceType: 'AWS::EC2::Instance',
        resourceId: 'i-abc123',
        configurationItemStatus: 'ResourceDiscovered',
      });

      expect(custom).toHaveBeenCalledWith({
        configRuleName: 'my-rule',
        resourceType: 'AWS::EC2::Instance',
        resourceId: 'i-abc123',
        configurationItemStatus: 'ResourceDiscovered',
      });
    });

    test('matches when standard filters and custom both pass', async () => {
      router.route(
        defineRoute({
          filters: {
            configRuleName: 'my-rule',
            custom: ({ resourceType }: ConfigChangeFilterInput): boolean => resourceType === 'AWS::EC2::Instance',
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule', resourceType: 'AWS::EC2::Instance' });

      expect(result).toBeDefined();
    });

    test('does not match when standard filters pass but custom returns false', async () => {
      router.route(
        defineRoute({
          filters: {
            configRuleName: 'my-rule',
            custom: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeUndefined();
    });

    test('custom is not called when an earlier filter fails', async () => {
      const custom = vi.fn().mockReturnValue(true);
      router.route(
        defineRoute({
          filters: {
            configRuleName: 'my-rule',
            custom,
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      await router.matchRoute({ configRuleName: 'other-rule' });

      expect(custom).not.toHaveBeenCalled();
    });

    test('matches route by async custom', async () => {
      router.route(
        defineRoute({
          filters: {
            custom: async ({ configRuleName }: ConfigChangeFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              return configRuleName === 'my-rule';
            },
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeDefined();
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

    test('uses configurationItem.configuration when no schema and configuration is undefined', async ({
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

    test('parses ruleParameters from JSON string', async ({ configEvent, context }) => {
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

suite('ConfigRouter.canHandleEvent', () => {
  const ownEvents = ['createConfigEvent'];

  test.each(allEventBuilders())('%s', async (name, build) => {
    const event = build();
    const isOwnEvent = ownEvents.includes(name);

    const claimed = await createConfigRouter().canHandleEvent(event);

    expect(claimed).toBe(isOwnEvent);
  });
});

// Values below are taken from events AWS Config delivered to the service example
suite('delivered event shapes', () => {
  const lambdaArn = 'arn:aws:lambda:eu-west-2:739650895623:function:ler-example-config-report-builder';

  const deletedLambdaItem = {
    relatedEvents: [],
    relationships: [],
    configuration: null,
    supplementaryConfiguration: {},
    tags: {},
    configurationItemVersion: '1.3',
    configurationItemCaptureTime: '2026-09-24T00:46:57.765Z',
    configurationStateId: 1790210817765,
    awsAccountId: '739650895623',
    configurationItemStatus: 'ResourceDeleted',
    resourceType: 'AWS::Lambda::Function',
    resourceId: 'ler-example-config-report-builder',
    resourceName: 'ler-example-config-report-builder',
    ARN: lambdaArn,
    awsRegion: 'eu-west-2',
    availabilityZone: null,
    configurationStateMd5Hash: '',
    resourceCreationTime: null,
    configurationItemDeliveryTime: null,
    recordingFrequency: null,
  } satisfies ConfigurationItem;

  const oversizedBucketSummary = {
    changeType: 'CREATE',
    configurationItemVersion: '1.3',
    configurationItemCaptureTime: '2026-09-24T00:57:36.160Z',
    configurationStateId: 1790211456160,
    awsAccountId: '739650895623',
    configurationItemStatus: 'ResourceDiscovered',
    resourceType: 'AWS::S3::Bucket',
    resourceId: 'ler-example-config-probebucket90ff141f-qeghkewxe8en',
    resourceName: 'ler-example-config-probebucket90ff141f-qeghkewxe8en',
    ARN: 'arn:aws:s3:::ler-example-config-probebucket90ff141f-qeghkewxe8en',
    awsRegion: 'eu-west-2',
    availabilityZone: 'Regional',
    configurationStateMd5Hash: '',
    resourceCreationTime: '2026-09-24T00:55:37.000Z',
    configurationItemDeliveryTime: null,
    recordingFrequency: null,
  } satisfies ConfigurationItemSummary;

  // Accepts any object, so the only thing it turns away is the null a deletion carries
  const objectSchema: StandardSchemaV1<unknown, Record<string, unknown>> = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value: unknown) =>
        typeof value === 'object' && value !== null
          ? { value: value as Record<string, unknown> }
          : { issues: [{ message: 'Expected an object' }] },
    },
  };

  function deliveredEvent(invokingEvent: Record<string, unknown>, ruleParameters?: string): ConfigEvent {
    return {
      version: '1.0',
      invokingEvent: JSON.stringify({ notificationCreationTime: '2026-09-24T00:46:58.813Z', ...invokingEvent }),
      ...(ruleParameters === undefined ? {} : { ruleParameters }),
      resultToken: 'result-token',
      eventLeftScope: invokingEvent.messageType === 'ConfigurationItemChangeNotification',
      executionRoleArn: 'arn:aws:iam::739650895623:role/ler-example-config-RecorderRole',
      configRuleArn: 'arn:aws:config:eu-west-2:739650895623:config-rule/config-rule-ekfflz',
      configRuleName: 'ler-example-config-memory-limit',
      configRuleId: 'config-rule-ekfflz',
      accountId: '739650895623',
      evaluationMode: 'DETECTIVE',
    };
  }

  function deletion(): ConfigEvent {
    return deliveredEvent(
      {
        configurationItemDiff: { changeType: 'DELETE', changedProperties: {} },
        configurationItem: deletedLambdaItem,
        messageType: 'ConfigurationItemChangeNotification',
        recordVersion: '1.3',
      },
      '{"maxMemoryMb":"1024"}',
    );
  }

  // The fixture declares the same shapes as types.ts, and cannot import them. This fails to compile
  // if the two drift apart.
  test('fixture events satisfy the package types', ({ configEvent, configurationItem, configurationItemSummary }) => {
    const event: ConfigEvent = configEvent();
    const item: ConfigurationItem = configurationItem();
    const summary: ConfigurationItemSummary = configurationItemSummary();

    expect([event.evaluationMode, item.configurationStateId, summary.configurationStateId]).toEqual([
      'DETECTIVE',
      1704067200000,
      1704067200000,
    ]);
  });

  test('a rule with no parameters sends no ruleParameters key, and the handler gets {}', async ({ context }) => {
    const handler = vi.fn();
    const router = createConfigRouter().route(defineRoute({ filters: {} }).handle(handler));

    const event = deliveredEvent({
      configurationItemDiff: null,
      configurationItem: { ...deletedLambdaItem, configurationItemStatus: 'OK', configuration: {} },
      messageType: 'ConfigurationItemChangeNotification',
      recordVersion: '1.3',
    });
    expect(event).not.toHaveProperty('ruleParameters');

    await router.handleEvent(event, context());

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ ruleParameters: {} }));
  });

  test('a deleted resource reaches a route with no configurationSchema with a null configuration', async ({
    context,
  }) => {
    const handler = vi.fn();
    const router = createConfigRouter().route(defineRoute({ filters: {} }).handle(handler));

    await router.handleEvent(deletion(), context());

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationItem: expect.objectContaining({ configuration: null, tags: {}, availabilityZone: null }),
      }),
    );
  });

  test('a deleted resource fails a configurationSchema that does not accept null', async ({ context }) => {
    const handler = vi.fn();
    const router = createConfigRouter().route(
      defineRoute({ filters: {}, configurationSchema: objectSchema }).handle(handler),
    );

    await expect(router.handleEvent(deletion(), context())).rejects.toThrow(
      'Schema validation failed for configuration',
    );
    expect(handler).not.toHaveBeenCalled();
  });

  test('a configurationItemStatus filter turns a deleted resource away', async ({ context }) => {
    const router = createConfigRouter().route(
      defineRoute({ filters: { configurationItemStatus: ['OK', 'ResourceDiscovered'] } }).handle(vi.fn()),
    );

    await expect(router.handleEvent(deletion(), context())).rejects.toThrow(
      'No route matched for config rule ler-example-config-memory-limit',
    );
  });

  test('relationships and the diff reach the handler as Config sends them', async ({ context }) => {
    const handler = vi.fn();
    const router = createConfigRouter().route(defineRoute({ filters: {} }).handle(handler));
    const relationship = {
      resourceId: null,
      resourceName: 'ler-example-config-CheckoutApiFnServiceRole',
      resourceType: 'AWS::IAM::Role',
      name: 'Is associated with ',
    };

    const event = deliveredEvent({
      configurationItemDiff: {
        changeType: 'UPDATE',
        changedProperties: {
          'Configuration.memorySize': { previousValue: 256, updatedValue: 512, changeType: 'UPDATE' },
        },
      },
      configurationItem: {
        ...deletedLambdaItem,
        configurationItemStatus: 'OK',
        configuration: { memorySize: 512 },
        relationships: [relationship],
      },
      messageType: 'ConfigurationItemChangeNotification',
      recordVersion: '1.3',
    });

    await router.handleEvent(event, context());

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationItem: expect.objectContaining({ relationships: [relationship] }),
      }),
    );
  });

  test('an oversized summary reaches a resourceType route with every field Config sends', async ({ context }) => {
    const handler = vi.fn();
    const router = createConfigRouter().route(
      defineRoute({ filters: { resourceType: 'AWS::S3::Bucket' } }).handle(handler),
    );

    const event = deliveredEvent({
      configurationItemSummary: oversizedBucketSummary,
      s3DeliverySummary: null,
      messageType: 'OversizedConfigurationItemChangeNotification',
      recordVersion: '1.0',
    });

    await router.handleEvent(event, context());

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ configurationItem: undefined, configurationItemSummary: oversizedBucketSummary }),
    );
  });
});

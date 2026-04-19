import * as base from '@lambda-event-router/base';
import type { ConfigEvent } from '@lambda-event-router/testing';
import { createConfigEvent, createMockSchema, test } from '@lambda-event-router/testing';
import type { MockInstance } from 'vitest';
import {
  ConfigScheduledRouter,
  createConfigScheduledRouter,
  defineConfigScheduledRoute,
} from './ConfigScheduledRouter.js';
import type { ConfigScheduledFilterInput } from './types.js';

const validateSchemaSpy: MockInstance = vi.spyOn(base, 'validateSchema');

suite('ConfigScheduledRouter', () => {
  let router: ConfigScheduledRouter;

  beforeEach(() => {
    router = new ConfigScheduledRouter();
  });

  suite('createConfigScheduledRouter', () => {
    test('creates a ConfigScheduledRouter instance', () => {
      const router = createConfigScheduledRouter();
      expect(router).toBeInstanceOf(ConfigScheduledRouter);
    });
  });

  suite('canHandleEvent', () => {
    test('returns false for non-object events', () => {
      expect(router.canHandleEvent(null)).toBe(false);
      expect(router.canHandleEvent(undefined)).toBe(false);
      expect(router.canHandleEvent('string')).toBe(false);
      expect(router.canHandleEvent(42)).toBe(false);
    });

    test('returns false when missing required string fields', () => {
      expect(router.canHandleEvent({ invokingEvent: 123, configRuleName: 'rule', resultToken: 'token' })).toBe(false);
      expect(router.canHandleEvent({ invokingEvent: '{}', configRuleName: 123, resultToken: 'token' })).toBe(false);
      expect(router.canHandleEvent({ invokingEvent: '{}', configRuleName: 'rule', resultToken: 123 })).toBe(false);
    });

    test('returns false when parsed invokingEvent is not an object', () => {
      expect(router.canHandleEvent({ invokingEvent: '"a string"', configRuleName: 'rule', resultToken: 'token' })).toBe(
        false,
      );
    });

    test('returns false for invalid JSON', () => {
      expect(router.canHandleEvent({ invokingEvent: 'not-json', configRuleName: 'rule', resultToken: 'token' })).toBe(
        false,
      );
    });

    test('returns false when messageType is ConfigurationItemChangeNotification', () => {
      const invokingEvent = JSON.stringify({ messageType: 'ConfigurationItemChangeNotification' });
      expect(router.canHandleEvent({ invokingEvent, configRuleName: 'rule', resultToken: 'token' })).toBe(false);
    });

    test('returns false when messageType is OversizedConfigurationItemChangeNotification', () => {
      const invokingEvent = JSON.stringify({ messageType: 'OversizedConfigurationItemChangeNotification' });
      expect(router.canHandleEvent({ invokingEvent, configRuleName: 'rule', resultToken: 'token' })).toBe(false);
    });

    test('returns true when messageType is ScheduledNotification', () => {
      const invokingEvent = JSON.stringify({ messageType: 'ScheduledNotification' });
      expect(router.canHandleEvent({ invokingEvent, configRuleName: 'rule', resultToken: 'token' })).toBe(true);
    });
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const definition = defineConfigScheduledRoute({ filters: {} }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });
  });

  suite('matchRoute', () => {
    test('matches when no filters set', async () => {
      router.route(defineConfigScheduledRoute({ filters: {} }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'any-rule', accountId: '123456789012' });

      expect(result).toBeDefined();
    });

    test('matches by configRuleName filter', async () => {
      router.route(defineConfigScheduledRoute({ filters: { configRuleName: 'my-rule' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule', accountId: '123456789012' });

      expect(result).toBeDefined();
    });

    test('matches by configRuleName filter array', async () => {
      router.route(
        defineConfigScheduledRoute({ filters: { configRuleName: ['my-rule', 'other-rule'] } }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule', accountId: '123456789012' });

      expect(result).toBeDefined();
    });

    test('rejects when configRuleName not in filter', async () => {
      router.route(defineConfigScheduledRoute({ filters: { configRuleName: 'my-rule' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'other-rule', accountId: '123456789012' });

      expect(result).toBeUndefined();
    });

    test('matches by accountId filter', async () => {
      router.route(defineConfigScheduledRoute({ filters: { accountId: '123456789012' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'any-rule', accountId: '123456789012' });

      expect(result).toBeDefined();
    });

    test('matches by accountId filter array', async () => {
      router.route(
        defineConfigScheduledRoute({ filters: { accountId: ['123456789012', '9876543210987'] } }).handle(
          async () => {},
        ),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'any-rule', accountId: '123456789012' });

      expect(result).toBeDefined();
    });

    test('rejects when accountId not in filter', async () => {
      router.route(defineConfigScheduledRoute({ filters: { accountId: '123456789012' } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'any-rule', accountId: '999999999999' });

      expect(result).toBeUndefined();
    });

    test('multiple filters combined - all must match', async () => {
      router.route(
        defineConfigScheduledRoute({
          filters: { configRuleName: 'my-rule', accountId: '123456789012' },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const matchBoth = await router.matchRoute({ configRuleName: 'my-rule', accountId: '123456789012' });
      expect(matchBoth).toBeDefined();

      // @ts-expect-error - testing private method directly
      const mismatchRule = await router.matchRoute({ configRuleName: 'other-rule', accountId: '123456789012' });
      expect(mismatchRule).toBeUndefined();

      // @ts-expect-error - testing private method directly
      const mismatchAccount = await router.matchRoute({ configRuleName: 'my-rule', accountId: '999999999999' });
      expect(mismatchAccount).toBeUndefined();
    });

    test('matches route by customFilter', async () => {
      router.route(
        defineConfigScheduledRoute({
          filters: {
            customFilter: ({ configRuleName }: ConfigScheduledFilterInput): boolean => configRuleName === 'my-rule',
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule', accountId: '123456789012' });

      expect(result).toBeDefined();
    });

    test('matches route by asyn customFilter', async () => {
      router.route(
        defineConfigScheduledRoute({
          filters: {
            customFilter: async ({ configRuleName }: ConfigScheduledFilterInput): Promise<boolean> => {
              await new Promise((r) => setTimeout(r, 1));
              return configRuleName === 'my-rule';
            },
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule', accountId: '123456789012' });

      expect(result).toBeDefined();
    });

    test('does not match route when customFilter returns false', async () => {
      router.route(
        defineConfigScheduledRoute({
          filters: {
            customFilter: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'any-rule', accountId: '123456789012' });

      expect(result).toBeUndefined();
    });

    test('passes correct filterInput to customFilter', async () => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.route(
        defineConfigScheduledRoute({
          filters: { customFilter },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      router.matchRoute({ configRuleName: 'my-rule', accountId: '123456789012' });

      expect(customFilter).toHaveBeenCalledWith({
        configRuleName: 'my-rule',
        accountId: '123456789012',
      });
    });

    test('matches when standard filters and customFilter both pass', async () => {
      router.route(
        defineConfigScheduledRoute({
          filters: {
            configRuleName: 'my-rule',
            customFilter: ({ accountId }: ConfigScheduledFilterInput): boolean => accountId === '123456789012',
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule', accountId: '123456789012' });

      expect(result).toBeDefined();
    });

    test('does not match when standard filters pass but customFilter returns false', async () => {
      router.route(
        defineConfigScheduledRoute({
          filters: {
            configRuleName: 'my-rule',
            customFilter: (): boolean => false,
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = await router.matchRoute({ configRuleName: 'my-rule', accountId: '123456789012' });

      expect(result).toBeUndefined();
    });

    test('customFilter is not called when an earlier filter fails', async () => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.route(
        defineConfigScheduledRoute({
          filters: {
            configRuleName: 'my-rule',
            customFilter,
          },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      router.matchRoute({ configRuleName: 'other-rule', accountId: '123456789012' });

      expect(customFilter).not.toHaveBeenCalled();
    });
  });

  suite('handleEvent', () => {
    function createScheduledConfigEvent(overrides: Parameters<typeof createConfigEvent>[0] = {}): ConfigEvent {
      return createConfigEvent({
        ...overrides,
        invokingEvent: {
          messageType: 'ScheduledNotification',
          ...overrides.invokingEvent,
        },
      });
    }

    test('calls handler with correct fields', async ({ context }) => {
      const handler = vi.fn();
      router.route(defineConfigScheduledRoute({ filters: {} }).handle(handler));

      const event = createScheduledConfigEvent({
        configRuleName: 'my-scheduled-rule',
        resultToken: 'my-token',
        accountId: '123456789012',
        ruleParameters: { env: 'prod' },
      });
      const mockContext = context();
      await router.handleEvent(event, mockContext);

      expect(handler).toHaveBeenCalledWith({
        resultToken: 'my-token',
        configRuleName: 'my-scheduled-rule',
        accountId: '123456789012',
        ruleParameters: { env: 'prod' },
        event,
        context: mockContext,
      });
    });

    test('defaults ruleParameters to empty object when empty string', async ({ context }) => {
      const handler = vi.fn();
      router.route(defineConfigScheduledRoute({ filters: {} }).handle(handler));

      const event = createScheduledConfigEvent();
      const modifiedEvent = { ...event, ruleParameters: '' };
      await router.handleEvent(modifiedEvent, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ ruleParameters: {} }));
    });

    test('throws when no route matches', async ({ context }) => {
      router.route(defineConfigScheduledRoute({ filters: { configRuleName: 'specific-rule' } }).handle(async () => {}));

      const event = createScheduledConfigEvent({ configRuleName: 'unknown-rule' });
      await expect(router.handleEvent(event, context())).rejects.toThrow(
        'No route matched for scheduled config rule unknown-rule',
      );
    });

    test('validates ruleParameters schema', async ({ context }) => {
      const handler = vi.fn();
      const ruleParametersSchema = createMockSchema();
      router.route(defineConfigScheduledRoute({ filters: {}, ruleParametersSchema }).handle(handler));

      const event = createScheduledConfigEvent({ ruleParameters: { env: 'prod' } });
      await router.handleEvent(event, context());

      expect(validateSchemaSpy).toHaveBeenCalledWith({ env: 'prod' }, ruleParametersSchema, expect.any(String));
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ ruleParameters: { env: 'prod' } }));
    });

    test('throws when ruleParameters schema validation fails', async ({ context }) => {
      const ruleParametersSchema = createMockSchema({ issues: [{ message: 'invalid' }] });
      router.route(defineConfigScheduledRoute({ filters: {}, ruleParametersSchema }).handle(async () => {}));

      const event = createScheduledConfigEvent({ ruleParameters: { bad: 'data' } });
      await expect(router.handleEvent(event, context())).rejects.toThrow('Schema validation failed for ruleParameters');
    });
  });

  suite('defineConfigScheduledRoute', () => {
    test('returns builder with handle method', () => {
      const builder = defineConfigScheduledRoute({ filters: { configRuleName: 'my-rule' } });
      expect(builder).toHaveProperty('handle');
      expect(builder.handle).toBeTypeOf('function');
    });

    test('handle returns a ConfigScheduledRouteDefinition', () => {
      const handler = vi.fn();
      const filters = { configRuleName: 'my-rule' };
      const definition = defineConfigScheduledRoute({ filters }).handle(handler);

      expect(definition).toEqual({
        filters,
        ruleParametersSchema: undefined,
        handler,
      });
    });
  });
});

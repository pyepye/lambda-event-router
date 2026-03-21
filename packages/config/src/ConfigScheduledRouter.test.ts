import type { Schema } from '@lambda-event-router/base';
import type { ConfigEvent } from '@lambda-event-router/testing';
import { createConfigEvent, test } from '@lambda-event-router/testing';
import {
  ConfigScheduledRouter,
  createConfigScheduledRouter,
  defineConfigScheduledRoute,
} from './ConfigScheduledRouter.js';

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
    test('matches when no filters set', () => {
      router.route(defineConfigScheduledRoute({ filters: {} }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute('any-rule', '123456789012');

      expect(result).toBeDefined();
    });

    test('matches by configRuleNames filter', () => {
      router.route(defineConfigScheduledRoute({ filters: { configRuleNames: ['my-rule'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute('my-rule', '123456789012');

      expect(result).toBeDefined();
    });

    test('rejects when configRuleName not in filter', () => {
      router.route(defineConfigScheduledRoute({ filters: { configRuleNames: ['my-rule'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute('other-rule', '123456789012');

      expect(result).toBeUndefined();
    });

    test('matches by accountIds filter', () => {
      router.route(defineConfigScheduledRoute({ filters: { accountIds: ['123456789012'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute('any-rule', '123456789012');

      expect(result).toBeDefined();
    });

    test('rejects when accountId not in filter', () => {
      router.route(defineConfigScheduledRoute({ filters: { accountIds: ['123456789012'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute('any-rule', '999999999999');

      expect(result).toBeUndefined();
    });

    test('multiple filters combined — all must match', () => {
      router.route(
        defineConfigScheduledRoute({
          filters: { configRuleNames: ['my-rule'], accountIds: ['123456789012'] },
        }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const matchBoth = router.matchRoute('my-rule', '123456789012');
      expect(matchBoth).toBeDefined();

      // @ts-expect-error - testing private method directly
      const mismatchRule = router.matchRoute('other-rule', '123456789012');
      expect(mismatchRule).toBeUndefined();

      // @ts-expect-error - testing private method directly
      const mismatchAccount = router.matchRoute('my-rule', '999999999999');
      expect(mismatchAccount).toBeUndefined();
    });
  });

  suite('validateSchema', () => {
    test('returns data unchanged when no schema provided', () => {
      const data = { key: 'value' };

      // @ts-expect-error - testing private method directly
      const result = router.validateSchema(data, undefined, 'test');

      expect(result).toBe(data);
    });

    test('returns data unchanged when data is undefined', () => {
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: true, data: {} }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateSchema(undefined, schema, 'test');

      expect(result).toBeUndefined();
    });

    test('returns validated data when schema passes', () => {
      const transformedData = { key: 'validated' };
      const schema: Schema<typeof transformedData> = {
        safeParse: () => ({ success: true, data: transformedData }),
      };

      // @ts-expect-error - testing private method directly
      const result = router.validateSchema({ key: 'original' }, schema, 'test');

      expect(result).toEqual(transformedData);
    });

    test('throws error when schema fails', () => {
      const schema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      // @ts-expect-error - testing private method directly
      expect(() => router.validateSchema({ key: 'value' }, schema, 'ruleParameters')).toThrow(
        'Schema validation failed for ruleParameters',
      );
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
      router.route(
        defineConfigScheduledRoute({ filters: { configRuleNames: ['specific-rule'] } }).handle(async () => {}),
      );

      const event = createScheduledConfigEvent({ configRuleName: 'unknown-rule' });
      await expect(router.handleEvent(event, context())).rejects.toThrow(
        'No route matched for scheduled config rule unknown-rule',
      );
    });

    test('validates ruleParameters schema', async ({ context }) => {
      const handler = vi.fn();
      const validatedParams = { env: 'prod-validated' };
      const ruleParametersSchema: Schema<typeof validatedParams> = {
        safeParse: () => ({ success: true, data: validatedParams }),
      };
      router.route(defineConfigScheduledRoute({ filters: {}, ruleParametersSchema }).handle(handler));

      const event = createScheduledConfigEvent({ ruleParameters: { env: 'prod' } });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ ruleParameters: validatedParams }));
    });

    test('throws when ruleParameters schema validation fails', async ({ context }) => {
      const ruleParametersSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };
      router.route(defineConfigScheduledRoute({ filters: {}, ruleParametersSchema }).handle(async () => {}));

      const event = createScheduledConfigEvent({ ruleParameters: { bad: 'data' } });
      await expect(router.handleEvent(event, context())).rejects.toThrow('Schema validation failed for ruleParameters');
    });
  });

  suite('defineConfigScheduledRoute', () => {
    test('returns builder with handle method', () => {
      const builder = defineConfigScheduledRoute({ filters: { configRuleNames: ['my-rule'] } });
      expect(builder).toHaveProperty('handle');
      expect(builder.handle).toBeTypeOf('function');
    });

    test('handle returns a ConfigScheduledRouteDefinition', () => {
      const handler = vi.fn();
      const filters = { configRuleNames: ['my-rule'] };
      const definition = defineConfigScheduledRoute({ filters }).handle(handler);

      expect(definition).toEqual({
        filters,
        ruleParametersSchema: undefined,
        handler,
      });
    });
  });
});

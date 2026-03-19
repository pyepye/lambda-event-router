import type { Schema } from '@lambda-event-router/base';
import { createConfigurationItem, createConfigurationItemSummary, test } from '@lambda-event-router/testing';
import { ConfigRouter, createConfigRouter, defineRoute } from './ConfigRouter.js';

suite('ConfigRouter', () => {
  suite('createConfigRouter', () => {
    test('creates a ConfigRouter instance', () => {
      const router = createConfigRouter();
      expect(router).toBeInstanceOf(ConfigRouter);
    });
  });

  suite('canHandleEvent', () => {
    let router: ConfigRouter;

    beforeEach(() => {
      router = new ConfigRouter();
    });

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
      const router = new ConfigRouter();
      const definition = defineRoute({
        filters: {},
      }).handle(async () => {});

      const result = router.route(definition);

      expect(result).toBe(router);
    });

    test('adds multiple routes', () => {
      const router = new ConfigRouter();
      const definitionA = defineRoute({ filters: { configRuleNames: ['rule-a'] } }).handle(async () => {});
      const definitionB = defineRoute({ filters: { configRuleNames: ['rule-b'] } }).handle(async () => {});

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
    let router: ConfigRouter;

    beforeEach(() => {
      router = new ConfigRouter();
    });

    test('matches when no filters set', () => {
      router.route(defineRoute({ filters: {} }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'any-rule' });

      expect(result).toBeDefined();
    });

    test('matches by configRuleNames filter', () => {
      router.route(defineRoute({ filters: { configRuleNames: ['my-rule'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeDefined();
    });

    test('rejects when configRuleName not in filter', () => {
      router.route(defineRoute({ filters: { configRuleNames: ['my-rule'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'other-rule' });

      expect(result).toBeUndefined();
    });

    test('matches by resourceTypes filter', () => {
      router.route(defineRoute({ filters: { resourceTypes: ['AWS::EC2::Instance'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceType: 'AWS::EC2::Instance' });

      expect(result).toBeDefined();
    });

    test('rejects when resourceType not in filter', () => {
      router.route(defineRoute({ filters: { resourceTypes: ['AWS::EC2::Instance'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceType: 'AWS::S3::Bucket' });

      expect(result).toBeUndefined();
    });

    test('skips resourceTypes filter when resourceType is undefined', () => {
      router.route(defineRoute({ filters: { resourceTypes: ['AWS::EC2::Instance'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceType: undefined });

      expect(result).toBeDefined();
    });

    test('matches by resourceIds filter', () => {
      router.route(defineRoute({ filters: { resourceIds: ['i-abc123'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceId: 'i-abc123' });

      expect(result).toBeDefined();
    });

    test('rejects when resourceId not in filter', () => {
      router.route(defineRoute({ filters: { resourceIds: ['i-abc123'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceId: 'i-other' });

      expect(result).toBeUndefined();
    });

    test('skips resourceIds filter when resourceId is undefined', () => {
      router.route(defineRoute({ filters: { resourceIds: ['i-abc123'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', resourceId: undefined });

      expect(result).toBeDefined();
    });

    test('matches by configurationItemStatuses filter', () => {
      router.route(
        defineRoute({ filters: { configurationItemStatuses: ['ResourceDiscovered'] } }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({
        configRuleName: 'rule',
        configurationItemStatus: 'ResourceDiscovered',
      });

      expect(result).toBeDefined();
    });

    test('rejects when configurationItemStatus not in filter', () => {
      router.route(
        defineRoute({ filters: { configurationItemStatuses: ['ResourceDiscovered'] } }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', configurationItemStatus: 'ResourceDeleted' });

      expect(result).toBeUndefined();
    });

    test('skips configurationItemStatuses filter when status is undefined', () => {
      router.route(
        defineRoute({ filters: { configurationItemStatuses: ['ResourceDiscovered'] } }).handle(async () => {}),
      );

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'rule', configurationItemStatus: undefined });

      expect(result).toBeDefined();
    });

    test('multiple filters combined — all must match', () => {
      router.route(
        defineRoute({
          filters: {
            configRuleNames: ['my-rule'],
            resourceTypes: ['AWS::EC2::Instance'],
            resourceIds: ['i-abc123'],
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
      router.route(defineRoute({ filters: { configRuleNames: ['my-rule'] } }).handle(async () => {}));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'nonexistent-rule' });

      expect(result).toBeUndefined();
    });

    test('returns first matching route when multiple routes exist', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.route(defineRoute({ filters: { configRuleNames: ['my-rule'] } }).handle(firstHandler));
      router.route(defineRoute({ filters: { configRuleNames: ['my-rule'] } }).handle(secondHandler));

      // @ts-expect-error - testing private method directly
      const result = router.matchRoute({ configRuleName: 'my-rule' });

      expect(result).toBeDefined();
      // @ts-expect-error - result is asserted as defined above
      expect(result.handler).toBe(firstHandler);
    });
  });

  suite('validateSchema', () => {
    let router: ConfigRouter;

    beforeEach(() => {
      router = new ConfigRouter();
    });

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
        'ruleParameters validation failed',
      );
    });
  });

  suite('handleEvent', () => {
    test('normal change notification calls handler with correct fields', async ({ configEvent, context }) => {
      const router = new ConfigRouter();
      const handler = vi.fn();
      const configItem = createConfigurationItem();

      router.route(defineRoute({ filters: {} }).handle(handler));

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
      const router = new ConfigRouter();
      const handler = vi.fn();
      const configItem = createConfigurationItem({ configuration: undefined });

      router.route(defineRoute({ filters: {} }).handle(handler));

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
      const router = new ConfigRouter();
      const handler = vi.fn();
      const summary = createConfigurationItemSummary();

      router.route(defineRoute({ filters: {} }).handle(handler));

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
      const router = new ConfigRouter();
      const handler = vi.fn();

      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = configEvent({ ruleParameters: { env: 'prod', region: 'us-east-1' } });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ ruleParameters: { env: 'prod', region: 'us-east-1' } }),
      );
    });

    test('defaults ruleParameters to empty object when empty string', async ({ configEvent, context }) => {
      const router = new ConfigRouter();
      const handler = vi.fn();

      router.route(defineRoute({ filters: {} }).handle(handler));

      const event = configEvent();
      const modifiedEvent = { ...event, ruleParameters: '' };
      await router.handleEvent(modifiedEvent, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ ruleParameters: {} }));
    });

    test('throws when no route matches', async ({ configEvent, context }) => {
      const router = new ConfigRouter();
      router.route(defineRoute({ filters: { configRuleNames: ['specific-rule'] } }).handle(async () => {}));

      const event = configEvent({ configRuleName: 'unknown-rule' });
      await expect(router.handleEvent(event, context())).rejects.toThrow(
        'No route matched for config rule unknown-rule',
      );
    });

    test('validates ruleParameters schema when provided', async ({ configEvent, context }) => {
      const router = new ConfigRouter();
      const handler = vi.fn();
      const validatedParams = { env: 'prod-validated' };
      const ruleParametersSchema: Schema<typeof validatedParams> = {
        safeParse: () => ({ success: true, data: validatedParams }),
      };

      router.route(defineRoute({ filters: {}, ruleParametersSchema }).handle(handler));

      const event = configEvent({ ruleParameters: { env: 'prod' } });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ ruleParameters: validatedParams }));
    });

    test('throws when ruleParameters schema validation fails', async ({ configEvent, context }) => {
      const router = new ConfigRouter();
      const ruleParametersSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid') }),
      };

      router.route(defineRoute({ filters: {}, ruleParametersSchema }).handle(async () => {}));

      const event = configEvent({ ruleParameters: { bad: 'data' } });
      await expect(router.handleEvent(event, context())).rejects.toThrow('ruleParameters validation failed');
    });

    test('validates configuration schema for normal events', async ({ configEvent, context }) => {
      const router = new ConfigRouter();
      const handler = vi.fn();
      const validatedConfig = { instanceType: 't3.large', validated: true };
      const configurationSchema: Schema<typeof validatedConfig> = {
        safeParse: () => ({ success: true, data: validatedConfig }),
      };

      router.route(defineRoute({ filters: {}, configurationSchema }).handle(handler));

      const event = configEvent({
        invokingEvent: {
          configurationItem: createConfigurationItem({
            configuration: { instanceType: 't2.micro' },
          }),
        },
      });
      await router.handleEvent(event, context());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          configurationItem: expect.objectContaining({ configuration: validatedConfig }),
        }),
      );
    });

    test('throws when configuration schema validation fails', async ({ configEvent, context }) => {
      const router = new ConfigRouter();
      const configurationSchema: Schema<unknown> = {
        safeParse: () => ({ success: false, error: new Error('invalid config') }),
      };

      router.route(defineRoute({ filters: {}, configurationSchema }).handle(async () => {}));

      const event = configEvent({
        invokingEvent: {
          configurationItem: createConfigurationItem({
            configuration: { bad: 'config' },
          }),
        },
      });
      await expect(router.handleEvent(event, context())).rejects.toThrow('configuration validation failed');
    });

    test('skips configuration schema validation for oversized events', async ({ configEvent, context }) => {
      const router = new ConfigRouter();
      const handler = vi.fn();
      const configurationSchema: Schema<unknown> = {
        safeParse: vi.fn(() => ({ success: false as const, error: new Error('should not be called') })),
      };

      router.route(defineRoute({ filters: {}, configurationSchema }).handle(handler));

      const event = configEvent({
        invokingEvent: {
          messageType: 'OversizedConfigurationItemChangeNotification',
          configurationItemSummary: createConfigurationItemSummary(),
        },
      });
      await router.handleEvent(event, context());

      expect(configurationSchema.safeParse).not.toHaveBeenCalled();
      expect(handler).toHaveBeenCalled();
    });
  });

  suite('defineRoute', () => {
    test('returns builder with handle method', () => {
      const builder = defineRoute({ filters: { configRuleNames: ['my-rule'] } });
      expect(builder).toHaveProperty('handle');
      expect(builder.handle).toBeTypeOf('function');
    });

    test('preserves filters, schemas, and handler in the definition', () => {
      const handler = vi.fn();
      const filters = { configRuleNames: ['my-rule'], resourceTypes: ['AWS::EC2::Instance'] };
      const ruleParametersSchema: Schema<{ env: string }> = {
        safeParse: () => ({ success: true, data: { env: 'prod' } }),
      };
      const configurationSchema: Schema<{ instanceType: string }> = {
        safeParse: () => ({ success: true, data: { instanceType: 't2.micro' } }),
      };

      const definition = defineRoute({ filters, ruleParametersSchema, configurationSchema }).handle(handler);

      expect(definition).toEqual({
        filters,
        ruleParametersSchema,
        configurationSchema,
        handler,
      });
    });
  });
});

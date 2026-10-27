import { createMockSchema } from '@latcher/testing';

import type { ConfigEvent } from '../types.js';
import { defineRoute } from './ConfigMatcher.js';
import type {
    ConfigOversizedRequest,
    ConfigRequest,
    ConfigRouteDefinition,
    ConfigurationItem,
    ConfigurationItemRelationship,
    ConfigurationItemSummary,
} from './types.js';

suite('ConfigRouteDefinition handler', () => {
  test('takes both notification shapes', () => {
    type Request = Parameters<ConfigRouteDefinition['handler']>[0];

    expectTypeOf<Request>().toEqualTypeOf<ConfigRequest | ConfigOversizedRequest>();
  });

  test('rejects a handler typed to the full item, which an oversized change does not carry', () => {
    const onChange = async ({ configurationItem }: ConfigRequest): Promise<void> => {
      await Promise.resolve(configurationItem.resourceId);
    };

    const definition: ConfigRouteDefinition = {
      filters: { configRuleName: 'required-tags' },
      // @ts-expect-error - an oversized change reaches this handler with no configurationItem
      handler: onChange,
    };

    expect(definition.handler).toBeTypeOf('function');
  });
});

suite('delivered item types', () => {
  test('a route with no configurationSchema allows a null configuration, which a deleted resource carries', () => {
    defineRoute({ filters: {} }).handle(async ({ configurationItem }) => {
      if (!configurationItem) return;
      expectTypeOf(configurationItem.configuration).toEqualTypeOf<Record<string, unknown> | null>();
    });
  });

  test('a route with a configurationSchema types configuration from the schema', () => {
    defineRoute({ filters: {}, configurationSchema: createMockSchema<{ memorySize: number }>() }).handle(
      async ({ configurationItem }) => {
        if (!configurationItem) return;
        expectTypeOf(configurationItem.configuration).toEqualTypeOf<{ memorySize: number }>();
      },
    );
  });

  test('a relationship is named by name, and its resourceId can be null', () => {
    expectTypeOf<ConfigurationItemRelationship>().toEqualTypeOf<{
      resourceType: string;
      resourceId: string | null;
      resourceName: string | null;
      name: string;
    }>();
  });

  test('configurationStateId is a number on a full item and on a summary', () => {
    expectTypeOf<ConfigurationItem['configurationStateId']>().toEqualTypeOf<number>();
    expectTypeOf<ConfigurationItemSummary['configurationStateId']>().toEqualTypeOf<number>();
  });

  test('ruleParameters is optional, because Config leaves it out when a rule has none', () => {
    expectTypeOf<ConfigEvent['ruleParameters']>().toEqualTypeOf<string | undefined>();
  });
});

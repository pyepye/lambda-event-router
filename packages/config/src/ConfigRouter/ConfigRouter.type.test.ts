import type { ConfigOversizedRequest, ConfigRequest, ConfigRouteDefinition } from './types.js';

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

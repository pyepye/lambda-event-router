import type { AppSyncEventsAuthorizerRouter } from './AppSyncEventsAuthorizerRouter.js';
import { createAppSyncEventsAuthorizerRouter, defineEventsAuthorizerRoute } from './AppSyncEventsAuthorizerRouter.js';
import type {
  AppSyncEventsAuthorizerChannelRequest,
  AppSyncEventsAuthorizerConnectRequest,
  AppSyncEventsAuthorizerRequest,
} from './types.js';

type RequestOf<TInput extends { handler: (request: never) => unknown }> = Parameters<TInput['handler']>[0];

const router: AppSyncEventsAuthorizerRouter = createAppSyncEventsAuthorizerRouter();

suite('convenience method narrowing', () => {
  test('connect takes a handler with no channel on its request', () => {
    type Request = RequestOf<Parameters<typeof router.connect>[0]>;

    expectTypeOf<Request>().toEqualTypeOf<AppSyncEventsAuthorizerConnectRequest>();
  });

  test('publish takes a handler whose channel is always there', () => {
    type Request = RequestOf<Parameters<typeof router.publish>[0]>;

    expectTypeOf<Request>().toEqualTypeOf<AppSyncEventsAuthorizerChannelRequest>();
    expectTypeOf<Request['channelPath']>().toEqualTypeOf<string>();
    expectTypeOf<Request['channelNamespace']>().toEqualTypeOf<string>();
  });

  test('subscribe takes the same channel handler as publish', () => {
    type Request = RequestOf<Parameters<typeof router.subscribe>[0]>;

    expectTypeOf<Request>().toEqualTypeOf<AppSyncEventsAuthorizerChannelRequest>();
  });
});

suite('defineEventsAuthorizerRoute operation narrowing', () => {
  test('narrows to the connect request for EVENT_CONNECT', () => {
    const builder = defineEventsAuthorizerRoute({ filters: { operation: 'EVENT_CONNECT' } });

    type Request = Parameters<Parameters<typeof builder.handle>[0]>[0];

    expectTypeOf<Request>().toEqualTypeOf<AppSyncEventsAuthorizerConnectRequest>();
  });

  test('narrows to the channel request for EVENT_PUBLISH', () => {
    const builder = defineEventsAuthorizerRoute({ filters: { operation: 'EVENT_PUBLISH' } });

    type Request = Parameters<Parameters<typeof builder.handle>[0]>[0];

    expectTypeOf<Request>().toEqualTypeOf<AppSyncEventsAuthorizerChannelRequest>();
  });

  test('narrows to the channel request for a list of channel operations', () => {
    const builder = defineEventsAuthorizerRoute({ filters: { operation: ['EVENT_PUBLISH', 'EVENT_SUBSCRIBE'] } });

    type Request = Parameters<Parameters<typeof builder.handle>[0]>[0];

    expectTypeOf<Request>().toEqualTypeOf<AppSyncEventsAuthorizerChannelRequest>();
  });

  test('leaves the loose request for a list that mixes connect with a channel operation', () => {
    const builder = defineEventsAuthorizerRoute({ filters: { operation: ['EVENT_CONNECT', 'EVENT_PUBLISH'] } });

    type Request = Parameters<Parameters<typeof builder.handle>[0]>[0];

    expectTypeOf<Request>().toEqualTypeOf<AppSyncEventsAuthorizerRequest>();
    expectTypeOf<Request['channelPath']>().toEqualTypeOf<string | undefined>();
  });

  test('leaves the loose request when no operation is filtered on', () => {
    const builder = defineEventsAuthorizerRoute({ filters: { channelNamespace: 'orders' } });

    type Request = Parameters<Parameters<typeof builder.handle>[0]>[0];

    expectTypeOf<Request>().toEqualTypeOf<AppSyncEventsAuthorizerRequest>();
  });
});

import type { WebSocketFilterInput, WebSocketFilters, WebSocketRequest } from './types.js';
import { createWebSocketRouter, defineWebSocketRoute } from './WebSocketRouter.js';

type ConvenienceFilters = Omit<WebSocketFilters, 'eventType'>;

suite('WebSocketRouter filter types', () => {
  suite('custom reaches every registration path', () => {
    test('route() takes a custom typed to WebSocketFilterInput', () => {
      createWebSocketRouter().route({
        filters: {
          eventType: 'MESSAGE',
          custom: ({ routeKey }: WebSocketFilterInput): boolean => routeKey.startsWith('admin:'),
        },
        handler: async () => undefined,
      });
    });

    test('defineWebSocketRoute takes a custom typed to WebSocketFilterInput', () => {
      defineWebSocketRoute({
        filters: {
          eventType: 'MESSAGE',
          custom: ({ routeKey }: WebSocketFilterInput): boolean => routeKey.startsWith('admin:'),
        },
      }).handle(async () => undefined);
    });

    test('connect() filters are every WebSocketFilters key but the one it pins', () => {
      type ConnectInput = Parameters<ReturnType<typeof createWebSocketRouter>['connect']>[0];
      expectTypeOf<NonNullable<ConnectInput['filters']>>().toEqualTypeOf<ConvenienceFilters>();
    });

    test('disconnect() filters are every WebSocketFilters key but the one it pins', () => {
      type DisconnectInput = Parameters<ReturnType<typeof createWebSocketRouter>['disconnect']>[0];
      expectTypeOf<NonNullable<DisconnectInput['filters']>>().toEqualTypeOf<ConvenienceFilters>();
    });

    test('message() filters are every WebSocketFilters key but the one it pins', () => {
      type MessageInput = Parameters<ReturnType<typeof createWebSocketRouter>['message']>[0];
      expectTypeOf<NonNullable<MessageInput['filters']>>().toEqualTypeOf<ConvenienceFilters>();
    });

    test('message() rejects an eventType, which it pins itself', () => {
      createWebSocketRouter().message({
        // @ts-expect-error - message() pins eventType to MESSAGE
        filters: { eventType: 'CONNECT' },
        handler: async () => {},
      });
    });
  });

  suite('eventType still narrows the request', () => {
    test('a CONNECT route gets queryStringParameters', () => {
      const builder = defineWebSocketRoute({ filters: { eventType: 'CONNECT' } });

      type Request = Parameters<Parameters<typeof builder.handle>[0]>[0];

      expectTypeOf<Request>().toEqualTypeOf<WebSocketRequest<unknown, Record<string, string> | undefined>>();
    });

    test('a MESSAGE route does not', () => {
      const builder = defineWebSocketRoute({ filters: { eventType: 'MESSAGE' } });

      type Request = Parameters<Parameters<typeof builder.handle>[0]>[0];

      expectTypeOf<Request>().toEqualTypeOf<WebSocketRequest<unknown, undefined>>();
    });
  });
});

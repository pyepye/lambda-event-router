import { Unauthorised } from '@lambda-event-router/http';

import type {
  WebSocketConnectRequest,
  WebSocketConnectResponse,
  WebSocketDisconnectRequest,
  WebSocketFilterInput,
  WebSocketFilters,
  WebSocketMessageRequest,
  WebSocketMessageRouteDefinition,
  WebSocketRequest,
  WebSocketRouteDefinition,
} from './types.js';
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

  suite('response helpers', () => {
    test('a connect handler returns a bare status code', () => {
      const response: WebSocketConnectResponse = { statusCode: 429 };

      expect(response).toEqual({ statusCode: 429 });
    });

    test('a connect handler cannot return an HTTP helper, whose body has nowhere to go', () => {
      // @ts-expect-error - an HTTP response carries a body and headers a WebSocket result drops
      const response: WebSocketConnectResponse = Unauthorised();

      expect(response).toHaveProperty('statusCode', 401);
    });
  });

  suite('eventType picks the request type', () => {
    test('a CONNECT route gets a connect request', () => {
      const builder = defineWebSocketRoute({ filters: { eventType: 'CONNECT' } });

      type Request = Parameters<Parameters<typeof builder.handle>[0]>[0];

      expectTypeOf<Request>().toEqualTypeOf<WebSocketConnectRequest>();
    });

    test('a MESSAGE route gets a message request', () => {
      const builder = defineWebSocketRoute({ filters: { eventType: 'MESSAGE' } });

      type Request = Parameters<Parameters<typeof builder.handle>[0]>[0];

      expectTypeOf<Request>().toEqualTypeOf<WebSocketMessageRequest<unknown>>();
    });

    test('a route with no eventType filter gets all three', () => {
      const builder = defineWebSocketRoute({ filters: {} });

      type Request = Parameters<Parameters<typeof builder.handle>[0]>[0];

      expectTypeOf<Request>().toEqualTypeOf<WebSocketRequest<unknown>>();
    });

    test('message() hands the handler a message request, with no query string on it', () => {
      type MessageDefinition = Parameters<ReturnType<typeof createWebSocketRouter>['message']>[0];
      type Request = Parameters<MessageDefinition['handler']>[0];

      expectTypeOf<Request>().toEqualTypeOf<WebSocketMessageRequest<unknown>>();
    });

    test('disconnect() hands the handler a disconnect request', () => {
      type DisconnectDefinition = Parameters<ReturnType<typeof createWebSocketRouter>['disconnect']>[0];
      type Request = Parameters<DisconnectDefinition['handler']>[0];

      expectTypeOf<Request>().toEqualTypeOf<WebSocketDisconnectRequest>();
    });

    test('connect() hands the handler a connect request', () => {
      type ConnectDefinition = Parameters<ReturnType<typeof createWebSocketRouter>['connect']>[0];
      type Request = Parameters<ConnectDefinition['handler']>[0];

      expectTypeOf<Request>().toEqualTypeOf<WebSocketConnectRequest>();
    });
  });

  suite('WebSocketRouteDefinition', () => {
    test('describes a route whose handler returns nothing', () => {
      const definition: WebSocketRouteDefinition = {
        filters: { eventType: 'MESSAGE' },
        handler: async (): Promise<void> => {},
      };

      expect(definition.handler).toBeTypeOf('function');
    });

    test('describes a route whose handler returns a status code', () => {
      const definition: WebSocketRouteDefinition = {
        filters: { eventType: 'CONNECT' },
        handler: async (): Promise<WebSocketConnectResponse> => ({ statusCode: 200 }),
      };

      expect(definition.handler).toBeTypeOf('function');
    });

    test('rejects a connect-only handler, which a matching route need not send', () => {
      const onConnect = async ({
        queryStringParameters,
      }: WebSocketConnectRequest): Promise<WebSocketConnectResponse> =>
        queryStringParameters?.token ? { statusCode: 200 } : { statusCode: 401 };

      const definition: WebSocketRouteDefinition = {
        filters: { eventType: 'MESSAGE' },
        // @ts-expect-error - this route can be handed a message, which onConnect cannot read
        handler: onConnect,
      };

      expect(definition.handler).toBeTypeOf('function');
    });

    test('the per-event definition types pin their own handler', () => {
      type Request = Parameters<WebSocketMessageRouteDefinition<{ content: string }>['handler']>[0];

      expectTypeOf<Request>().toEqualTypeOf<WebSocketMessageRequest<{ content: string }>>();
    });
  });
});

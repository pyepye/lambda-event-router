import { HTTPMatcher } from '@latcher/http';

import { createAPIGatewayMatcher, defineRoute } from './APIGatewayMatcher.js';
import type { APIGatewayEvent } from './apiGatewayAdapter.js';
import { type APIGatewayV2EventType, apiGatewayV2Adapter } from './apiGatewayV2Adapter.js';
import type { ApiHandler, ApiRequest, HTTPFilterInput, HTTPFilters, HTTPMiddleware, RouteDefinition } from './types.js';

type FilterFunction = NonNullable<HTTPFilters['custom']>;

suite('API Gateway event type', () => {
  test('every request alias defaults the event to APIGatewayEvent', () => {
    expectTypeOf<ApiRequest['event']>().toEqualTypeOf<APIGatewayEvent>();
    expectTypeOf<Parameters<ApiHandler>[0]['event']>().toEqualTypeOf<APIGatewayEvent>();
    expectTypeOf<Parameters<RouteDefinition['handler']>[0]['event']>().toEqualTypeOf<APIGatewayEvent>();
  });

  test('HTTPMiddleware defaults the event to APIGatewayEvent', () => {
    // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters, which is what this test asserts
    const readsEvent: HTTPMiddleware = async (request, next) => {
      expectTypeOf(request.event).toEqualTypeOf<APIGatewayEvent>();
      return next(request);
    };

    expect(readsEvent).toBeTypeOf('function');
  });

  test('every filter alias defaults the event to APIGatewayEvent', () => {
    expectTypeOf<HTTPFilterInput['event']>().toEqualTypeOf<APIGatewayEvent>();
    expectTypeOf<Parameters<FilterFunction>[0]['event']>().toEqualTypeOf<APIGatewayEvent>();
  });

  test('the matcher hands an inline handler an APIGatewayEvent', () => {
    createAPIGatewayMatcher().get({
      filters: { path: '/orders' },
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request.event).toEqualTypeOf<APIGatewayEvent>();
      },
    });
  });

  test('defineRoute hands the handler an APIGatewayEvent', () => {
    defineRoute({ filters: { method: 'GET', path: '/orders' } }).handle(async (request) => {
      expectTypeOf(request.event).toEqualTypeOf<APIGatewayEvent>();
    });
  });

  test('a rawPath check narrows the event to a 2.0 payload', () => {
    defineRoute({ filters: { method: 'GET', path: '/orders' } }).handle(async (request) => {
      const method = 'rawPath' in request.event ? request.event.requestContext.http.method : request.event.httpMethod;
      expectTypeOf(method).toEqualTypeOf<string>();
    });
  });

  test('HTTPMatcher with the 2.0 adapter hands the handler only 2.0 payloads', () => {
    new HTTPMatcher(apiGatewayV2Adapter).get({
      filters: { path: '/orders' },
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request.event).toEqualTypeOf<APIGatewayV2EventType>();
      },
    });
  });
});

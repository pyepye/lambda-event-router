import type { ALBEvent } from 'aws-lambda';

import { createALBRouter, defineRoute } from './ALBRouter.js';
import type { ApiHandler, ApiRequest, HTTPFilterInput, HTTPFilters, HTTPMiddleware, RouteDefinition } from './types.js';

type FilterFunction = NonNullable<HTTPFilters['custom']>;

suite('ALB event type', () => {
  test('every request alias defaults the event to ALBEvent', () => {
    expectTypeOf<ApiRequest['event']>().toEqualTypeOf<ALBEvent>();
    expectTypeOf<Parameters<ApiHandler>[0]['event']>().toEqualTypeOf<ALBEvent>();
    expectTypeOf<Parameters<RouteDefinition['handler']>[0]['event']>().toEqualTypeOf<ALBEvent>();
  });

  test('HTTPMiddleware defaults the event to ALBEvent', () => {
    // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters, which is what this test asserts
    const readsEvent: HTTPMiddleware = async (request, next) => {
      expectTypeOf(request.event).toEqualTypeOf<ALBEvent>();
      return next(request);
    };

    expect(readsEvent).toBeTypeOf('function');
  });

  test('every filter alias defaults the event to ALBEvent', () => {
    expectTypeOf<HTTPFilterInput['event']>().toEqualTypeOf<ALBEvent>();
    expectTypeOf<Parameters<FilterFunction>[0]['event']>().toEqualTypeOf<ALBEvent>();
  });

  test('the router hands an inline handler an ALBEvent', () => {
    createALBRouter().get({
      filters: { path: '/returns' },
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request.event).toEqualTypeOf<ALBEvent>();
      },
    });
  });

  test('defineRoute hands the handler an ALBEvent', () => {
    defineRoute({ filters: { method: 'GET', path: '/returns' } }).handle(async (request) => {
      expectTypeOf(request.event.requestContext.elb.targetGroupArn).toEqualTypeOf<string>();
    });
  });
});

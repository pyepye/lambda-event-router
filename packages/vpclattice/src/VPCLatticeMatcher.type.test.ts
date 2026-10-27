import { HTTPMatcher } from '@latcher/http';

import type { ApiHandler, ApiRequest, HTTPFilterInput, HTTPFilters, HTTPMiddleware, RouteDefinition } from './types.js';
import type { VPCLatticeEvent } from './vpcLatticeAdapter.js';
import { createVPCLatticeMatcher, defineRoute } from './VPCLatticeMatcher.js';
import { type VPCLatticeEventV2, vpcLatticeV2Adapter } from './vpcLatticeV2Adapter.js';

type FilterFunction = NonNullable<HTTPFilters['custom']>;

suite('VPC Lattice event type', () => {
  test('every request alias defaults the event to VPCLatticeEvent', () => {
    expectTypeOf<ApiRequest['event']>().toEqualTypeOf<VPCLatticeEvent>();
    expectTypeOf<Parameters<ApiHandler>[0]['event']>().toEqualTypeOf<VPCLatticeEvent>();
    expectTypeOf<Parameters<RouteDefinition['handler']>[0]['event']>().toEqualTypeOf<VPCLatticeEvent>();
  });

  test('HTTPMiddleware defaults the event to VPCLatticeEvent', () => {
    // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters, which is what this test asserts
    const readsEvent: HTTPMiddleware = async (request, next) => {
      expectTypeOf(request.event).toEqualTypeOf<VPCLatticeEvent>();
      return next(request);
    };

    expect(readsEvent).toBeTypeOf('function');
  });

  test('every filter alias defaults the event to VPCLatticeEvent', () => {
    expectTypeOf<HTTPFilterInput['event']>().toEqualTypeOf<VPCLatticeEvent>();
    expectTypeOf<Parameters<FilterFunction>[0]['event']>().toEqualTypeOf<VPCLatticeEvent>();
  });

  test('the matcher hands an inline handler a VPCLatticeEvent', () => {
    createVPCLatticeMatcher().get({
      filters: { path: '/stock' },
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request.event).toEqualTypeOf<VPCLatticeEvent>();
      },
    });
  });

  test('defineRoute hands the handler a VPCLatticeEvent', () => {
    defineRoute({ filters: { method: 'GET', path: '/stock' } }).handle(async (request) => {
      expectTypeOf(request.event).toEqualTypeOf<VPCLatticeEvent>();
    });
  });

  test('a requestContext check narrows the event to a 2.0 payload', () => {
    defineRoute({ filters: { method: 'GET', path: '/stock' } }).handle(async (request) => {
      const serviceArn = 'requestContext' in request.event ? request.event.requestContext.serviceArn : undefined;
      expectTypeOf(serviceArn).toEqualTypeOf<string | undefined>();
    });
  });

  test('HTTPMatcher with the 2.0 adapter hands the handler a VPCLatticeEventV2', () => {
    new HTTPMatcher(vpcLatticeV2Adapter).get({
      filters: { path: '/stock' },
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      handler: async (request) => {
        expectTypeOf(request.event).toEqualTypeOf<VPCLatticeEventV2>();
      },
    });
  });
});

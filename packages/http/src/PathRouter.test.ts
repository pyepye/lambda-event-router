import { createMockSchema } from '@lambda-event-router/testing';

import { PathRouter } from './PathRouter.js';

suite('PathRouter', () => {
  let router: PathRouter;

  beforeEach(() => {
    router = new PathRouter();
  });

  test('returns the router instance for chaining', () => {
    const config = { filters: { path: '/items' }, handler: vi.fn() };

    expect(router.get(config)).toBe(router);
    expect(router.head(config)).toBe(router);
    expect(router.delete(config)).toBe(router);
    expect(router.options(config)).toBe(router);
    expect(router.post(config)).toBe(router);
    expect(router.put(config)).toBe(router);
    expect(router.patch(config)).toBe(router);
  });

  suite('route', () => {
    test('returns the router instance for chaining', () => {
      const result = router.route({
        filters: { method: 'GET', path: '/items' },
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });

    test('registers routes with a lowercase method', async () => {
      router.route({
        filters: { method: 'get', path: '/items' },
        handler: vi.fn(),
      });

      expect(await router.match('GET', '/items')).not.toBeNull();
    });
  });

  suite('compilePath', () => {
    test('returns empty pathParamNames and an exact-match pattern for a static path', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/items');

      expect(result.pathParamNames).toEqual([]);
      expect(result.pattern.test('/items')).toBe(true);
      expect(result.pattern.test('/other')).toBe(false);
    });

    test('extracts a single param name and matches dynamic segments', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/items/:id');

      expect(result.pathParamNames).toEqual(['id']);
      expect(result.pattern.test('/items/abc-123')).toBe(true);
    });

    test('extracts multiple param names in order', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/items/:itemId/sub/:subId');

      expect(result.pathParamNames).toEqual(['itemId', 'subId']);
      expect(result.pattern.test('/items/1/sub/2')).toBe(true);
    });

    test('anchors the pattern so it does not match partial paths', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/items');

      expect(result.pattern.test('/items/extra')).toBe(false);
      expect(result.pattern.test('/prefix/items')).toBe(false);
    });

    test('treats a dot in a literal segment as a literal, not "any character"', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/v1.0/orders');

      expect(result.pattern.test('/v1.0/orders')).toBe(true);
      expect(result.pattern.test('/v1X0/orders')).toBe(false);
    });

    test('treats regex quantifiers in a literal segment as literals', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/orders+');

      expect(result.pattern.test('/orders+')).toBe(true);
      expect(result.pattern.test('/orderssss')).toBe(false);
    });

    test('does not let a literal segment match across path separators', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/orders/.*');

      expect(result.pattern.test('/orders/.*')).toBe(true);
      expect(result.pattern.test('/orders/anything/deep')).toBe(false);
    });
  });

  suite('addRoute', () => {
    test('stores route with all schemas, handler, compiled pattern, and pathParamNames', async () => {
      const handler = vi.fn();
      const querySchema = createMockSchema();
      const bodySchema = createMockSchema();
      const responseSchema = createMockSchema();

      // @ts-expect-error - testing private method directly
      router.addRoute('POST', {
        filters: { path: '/items/:id' },
        handler,
        querySchema,
        bodySchema,
        responseSchema,
      });

      const match = await router.match('POST', '/items/123');
      expect(match).not.toBeNull();
      expect(match?.route.handler).toBe(handler);
      expect(match?.route.querySchema).toBe(querySchema);
      expect(match?.route.bodySchema).toBe(bodySchema);
      expect(match?.route.responseSchema).toBe(responseSchema);
      expect(match?.route.pathParamNames).toEqual(['id']);
      expect(match?.params).toEqual({ id: '123' });
    });
  });

  suite('match', () => {
    test('matches a static path', async () => {
      const handler = vi.fn();
      router.get({ filters: { path: '/items' }, handler });

      const result = await router.match('GET', '/items');

      expect(result).not.toBeNull();
      expect(result?.route.path).toBe('/items');
      expect(result?.params).toEqual({});
    });

    test('returns null when no route matches', async () => {
      router.get({ filters: { path: '/items' }, handler: vi.fn() });

      const result = await router.match('GET', '/unknown');

      expect(result).toBeNull();
    });

    test('returns null when method does not match', async () => {
      router.get({ filters: { path: '/items' }, handler: vi.fn() });

      const result = await router.match('POST', '/items');

      expect(result).toBeNull();
    });

    test('extracts a single path parameter', async () => {
      router.get({ filters: { path: '/items/:id' }, handler: vi.fn() });

      const result = await router.match('GET', '/items/abc-123');

      expect(result).not.toBeNull();
      expect(result?.params).toEqual({ id: 'abc-123' });
    });

    test('extracts multiple path parameters', async () => {
      router.get({ filters: { path: '/items/:itemId/sub/:subId' }, handler: vi.fn() });

      const result = await router.match('GET', '/items/item-1/sub/sub-2');

      expect(result).not.toBeNull();
      expect(result?.params).toEqual({ itemId: 'item-1', subId: 'sub-2' });
    });

    test('does not match a partial path', async () => {
      router.get({ filters: { path: '/items' }, handler: vi.fn() });

      const result = await router.match('GET', '/items/extra');

      expect(result).toBeNull();
    });

    test('does not match a shorter path', async () => {
      router.get({ filters: { path: '/items/:id' }, handler: vi.fn() });

      const result = await router.match('GET', '/items');

      expect(result).toBeNull();
    });

    test('matches a request with a trailing slash against a route registered without one', async () => {
      router.get({ filters: { path: '/items' }, handler: vi.fn() });

      const result = await router.match('GET', '/items/');

      expect(result).not.toBeNull();
      expect(result?.route.path).toBe('/items');
      expect(result?.params).toEqual({});
    });

    test('matches a request without a trailing slash against a route registered with one', async () => {
      router.get({ filters: { path: '/items/' }, handler: vi.fn() });

      const result = await router.match('GET', '/items');

      expect(result).not.toBeNull();
      expect(result?.route.path).toBe('/items');
      expect(result?.params).toEqual({});
    });

    test('matches a parameterized path with a trailing slash and still extracts params', async () => {
      router.get({ filters: { path: '/items/:id' }, handler: vi.fn() });

      const result = await router.match('GET', '/items/abc-123/');

      expect(result).not.toBeNull();
      expect(result?.params).toEqual({ id: 'abc-123' });
    });

    test('matches the root path and does not match an empty path', async () => {
      router.get({ filters: { path: '/' }, handler: vi.fn() });

      const rootResult = await router.match('GET', '/');
      const emptyResult = await router.match('GET', '');

      expect(rootResult).not.toBeNull();
      expect(emptyResult).toBeNull();
    });

    test('matches the correct method when multiple routes share the same path', async () => {
      const getHandler = vi.fn();
      const postHandler = vi.fn();
      router.get({ filters: { path: '/items' }, handler: getHandler });
      router.post({ filters: { path: '/items' }, handler: postHandler });

      const getResult = await router.match('GET', '/items');
      const postResult = await router.match('POST', '/items');

      expect(getResult?.route.handler).toBe(getHandler);
      expect(postResult?.route.handler).toBe(postHandler);
    });

    test('the more specific route wins over a param route regardless of registration order', async () => {
      const paramHandler = vi.fn();
      const literalHandler = vi.fn();
      router.get({ filters: { path: '/orders/:orderId' }, handler: paramHandler });
      router.get({ filters: { path: '/orders/latest' }, handler: literalHandler });

      expect((await router.match('GET', '/orders/latest'))?.route.handler).toBe(literalHandler);
      expect((await router.match('GET', '/orders/99'))?.route.handler).toBe(paramHandler);
    });

    test('returns the handler reference from the matched route', async () => {
      const handler = vi.fn();
      router.post({ filters: { path: '/items' }, handler });

      const result = await router.match('POST', '/items');

      expect(result?.route.handler).toBe(handler);
    });

    test('matches all HTTP methods', async () => {
      router.get({ filters: { path: '/a' }, handler: vi.fn() });
      router.head({ filters: { path: '/b' }, handler: vi.fn() });
      router.delete({ filters: { path: '/c' }, handler: vi.fn() });
      router.options({ filters: { path: '/d' }, handler: vi.fn() });
      router.post({ filters: { path: '/e' }, handler: vi.fn() });
      router.put({ filters: { path: '/f' }, handler: vi.fn() });
      router.patch({ filters: { path: '/g' }, handler: vi.fn() });

      expect(await router.match('GET', '/a')).not.toBeNull();
      expect(await router.match('HEAD', '/b')).not.toBeNull();
      expect(await router.match('DELETE', '/c')).not.toBeNull();
      expect(await router.match('OPTIONS', '/d')).not.toBeNull();
      expect(await router.match('POST', '/e')).not.toBeNull();
      expect(await router.match('PUT', '/f')).not.toBeNull();
      expect(await router.match('PATCH', '/g')).not.toBeNull();
    });

    test('skips route when customFilter returns false', async () => {
      router.get({
        filters: {
          path: '/items',
          customFilter: () => false,
        },
        handler: vi.fn(),
      });

      const result = await router.match('GET', '/items', {});

      expect(result).toBeNull();
    });

    test('matches route when customFilter returns true', async () => {
      const handler = vi.fn();
      router.get({
        filters: {
          path: '/items',
          customFilter: () => true,
        },
        handler,
      });

      const result = await router.match('GET', '/items', {});

      expect(result).not.toBeNull();
      expect(result?.route.handler).toBe(handler);
    });

    test('passes filterInput to customFilter', async () => {
      const customFilter = vi.fn().mockReturnValue(true);
      router.get({
        filters: { path: '/items', customFilter },
        handler: vi.fn(),
      });

      const filterInput = { method: 'GET', path: '/items', headers: { authorization: 'Bearer token' } };
      await router.match('GET', '/items', filterInput);

      expect(customFilter).toHaveBeenCalledWith(filterInput);
    });

    test('falls through to next route when customFilter rejects first match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.get({
        filters: {
          path: '/items',
          customFilter: () => false,
        },
        handler: firstHandler,
      });
      router.get({
        filters: { path: '/items' },
        handler: secondHandler,
      });

      const result = await router.match('GET', '/items', {});

      expect(result).not.toBeNull();
      expect(result?.route.handler).toBe(secondHandler);
    });

    test('does not call customFilter when method does not match', async () => {
      const customFilter = vi.fn();
      router.get({
        filters: { path: '/items', customFilter },
        handler: vi.fn(),
      });

      await router.match('POST', '/items', {});

      expect(customFilter).not.toHaveBeenCalled();
    });

    test('does not call customFilter when path does not match', async () => {
      const customFilter = vi.fn();
      router.get({
        filters: { path: '/items', customFilter },
        handler: vi.fn(),
      });

      await router.match('GET', '/other', {});

      expect(customFilter).not.toHaveBeenCalled();
    });
  });

  suite('specificity', () => {
    test('a literal segment beats a param at the same position, registered param first', async () => {
      const paramHandler = vi.fn();
      const literalHandler = vi.fn();
      router.get({ filters: { path: '/orders/:orderId' }, handler: paramHandler });
      router.get({ filters: { path: '/orders/latest' }, handler: literalHandler });

      expect((await router.match('GET', '/orders/latest'))?.route.handler).toBe(literalHandler);
    });

    test('a literal segment beats a param at the same position, registered literal first', async () => {
      const paramHandler = vi.fn();
      const literalHandler = vi.fn();
      router.get({ filters: { path: '/orders/latest' }, handler: literalHandler });
      router.get({ filters: { path: '/orders/:orderId' }, handler: paramHandler });

      expect((await router.match('GET', '/orders/latest'))?.route.handler).toBe(literalHandler);
      expect((await router.match('GET', '/orders/99'))?.route.handler).toBe(paramHandler);
    });

    test('an earlier literal wins over an earlier param when both routes match, param route first', async () => {
      const earlyParam = vi.fn(); // /a/:x/c
      const earlyLiteral = vi.fn(); // /a/b/:y
      router.get({ filters: { path: '/a/:x/c' }, handler: earlyParam });
      router.get({ filters: { path: '/a/b/:y' }, handler: earlyLiteral });

      expect((await router.match('GET', '/a/b/c'))?.route.handler).toBe(earlyLiteral);
    });

    test('an earlier literal wins over an earlier param when both routes match, literal route first', async () => {
      const earlyParam = vi.fn(); // /a/:x/c
      const earlyLiteral = vi.fn(); // /a/b/:y
      router.get({ filters: { path: '/a/b/:y' }, handler: earlyLiteral });
      router.get({ filters: { path: '/a/:x/c' }, handler: earlyParam });

      expect((await router.match('GET', '/a/b/c'))?.route.handler).toBe(earlyLiteral);
    });

    test('a fully literal route wins over every partially-param route matching the same path', async () => {
      const fullLiteral = vi.fn();
      router.get({ filters: { path: '/a/:x/:y' }, handler: vi.fn() });
      router.get({ filters: { path: '/a/b/:y' }, handler: vi.fn() });
      router.get({ filters: { path: '/a/:x/c' }, handler: vi.fn() });
      router.get({ filters: { path: '/a/b/c' }, handler: fullLiteral });

      expect((await router.match('GET', '/a/b/c'))?.route.handler).toBe(fullLiteral);
    });

    test('keeps both routes matchable when equally specific but non-overlapping', async () => {
      const xHandler = vi.fn();
      const yHandler = vi.fn();
      router.get({ filters: { path: '/a/x' }, handler: xHandler });
      router.get({ filters: { path: '/a/y' }, handler: yHandler });

      expect((await router.match('GET', '/a/x'))?.route.handler).toBe(xHandler);
      expect((await router.match('GET', '/a/y'))?.route.handler).toBe(yHandler);
    });

    test('throws when two routes of the same method share a shape and differ only in param name', () => {
      router.get({ filters: { path: '/items/:id' }, handler: vi.fn() });

      expect(() => router.get({ filters: { path: '/items/:slug' }, handler: vi.fn() })).toThrow(
        /ambiguous/i,
      );
    });

    test('does not treat the same shape under a different method as ambiguous', () => {
      router.get({ filters: { path: '/items/:id' }, handler: vi.fn() });

      expect(() => router.post({ filters: { path: '/items/:slug' }, handler: vi.fn() })).not.toThrow();
    });

    test('exempts an ambiguous pair from the throw when one route carries a customFilter', async () => {
      const guarded = vi.fn();
      const fallback = vi.fn();

      expect(() => {
        router.get({
          filters: { path: '/items/:id', customFilter: (input) => input === 'guarded' },
          handler: guarded,
        });
        router.get({ filters: { path: '/items/:slug' }, handler: fallback });
      }).not.toThrow();

      expect((await router.match('GET', '/items/1', 'guarded'))?.route.handler).toBe(guarded);
      expect((await router.match('GET', '/items/1', 'other'))?.route.handler).toBe(fallback);
    });
  });

  suite('getMethodsForPath', () => {
    test('ignores customFilter and returns methods based on path only', () => {
      router.get({
        filters: {
          path: '/items',
          customFilter: () => false,
        },
        handler: vi.fn(),
      });
      router.post({
        filters: { path: '/items' },
        handler: vi.fn(),
      });

      const methods = router.getMethodsForPath('/items');

      expect(methods).toEqual(['GET', 'POST']);
    });

    test('returns methods when the requested path has a trailing slash', () => {
      router.get({ filters: { path: '/items' }, handler: vi.fn() });
      router.post({ filters: { path: '/items' }, handler: vi.fn() });

      const methods = router.getMethodsForPath('/items/');

      expect(methods).toEqual(['GET', 'POST']);
    });

    test('returns every method matching a path once routes are specificity sorted', () => {
      router.get({ filters: { path: '/orders/:orderId' }, handler: vi.fn() });
      router.delete({ filters: { path: '/orders/:orderId' }, handler: vi.fn() });
      router.get({ filters: { path: '/orders/latest' }, handler: vi.fn() });

      expect(router.getMethodsForPath('/orders/latest').sort()).toEqual(['DELETE', 'GET']);
    });
  });
});

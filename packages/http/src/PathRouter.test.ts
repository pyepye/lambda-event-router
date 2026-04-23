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
    test('returns empty paramNames and an exact-match pattern for a static path', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/items');

      expect(result.paramNames).toEqual([]);
      expect(result.pattern.test('/items')).toBe(true);
      expect(result.pattern.test('/other')).toBe(false);
    });

    test('extracts a single param name and matches dynamic segments', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/items/:id');

      expect(result.paramNames).toEqual(['id']);
      expect(result.pattern.test('/items/abc-123')).toBe(true);
    });

    test('extracts multiple param names in order', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/items/:itemId/sub/:subId');

      expect(result.paramNames).toEqual(['itemId', 'subId']);
      expect(result.pattern.test('/items/1/sub/2')).toBe(true);
    });

    test('anchors the pattern so it does not match partial paths', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/items');

      expect(result.pattern.test('/items/extra')).toBe(false);
      expect(result.pattern.test('/prefix/items')).toBe(false);
    });
  });

  suite('addRoute', () => {
    test('stores route with all schemas, handler, compiled pattern, and paramNames', async () => {
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
      expect(match?.route.paramNames).toEqual(['id']);
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

    test('returns the first match when multiple routes could match the same path', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.get({ filters: { path: '/items/:id' }, handler: firstHandler });
      router.get({ filters: { path: '/items/:slug' }, handler: secondHandler });

      const result = await router.match('GET', '/items/abc');

      expect(result?.route.handler).toBe(firstHandler);
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
  });
});

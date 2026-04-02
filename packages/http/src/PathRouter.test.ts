import { createMockSchema } from '@lambda-event-router/testing';
import { PathRouter } from './PathRouter.js';

suite('PathRouter', () => {
  let router: PathRouter;

  beforeEach(() => {
    router = new PathRouter();
  });

  test('returns the router instance for chaining', () => {
    const config = { path: '/items', handler: vi.fn() };

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
        method: 'GET',
        path: '/items',
        handler: vi.fn(),
      });

      expect(result).toBe(router);
    });

    test('registers routes with a lowercase method', () => {
      router.route({
        method: 'get',
        path: '/items',
        handler: vi.fn(),
      });

      expect(router.match('GET', '/items')).not.toBeNull();
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
    test('stores route with all schemas, handler, compiled pattern, and paramNames', () => {
      const handler = vi.fn();
      const querySchema = createMockSchema();
      const bodySchema = createMockSchema();
      const responseSchema = createMockSchema();

      // @ts-expect-error - testing private method directly
      router.addRoute('POST', {
        path: '/items/:id',
        handler,
        querySchema,
        bodySchema,
        responseSchema,
      });

      const match = router.match('POST', '/items/123');
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
    test('matches a static path', () => {
      const handler = vi.fn();
      router.get({ path: '/items', handler });

      const result = router.match('GET', '/items');

      expect(result).not.toBeNull();
      expect(result?.route.path).toBe('/items');
      expect(result?.params).toEqual({});
    });

    test('returns null when no route matches', () => {
      router.get({ path: '/items', handler: vi.fn() });

      const result = router.match('GET', '/unknown');

      expect(result).toBeNull();
    });

    test('returns null when method does not match', () => {
      router.get({ path: '/items', handler: vi.fn() });

      const result = router.match('POST', '/items');

      expect(result).toBeNull();
    });

    test('extracts a single path parameter', () => {
      router.get({ path: '/items/:id', handler: vi.fn() });

      const result = router.match('GET', '/items/abc-123');

      expect(result).not.toBeNull();
      expect(result?.params).toEqual({ id: 'abc-123' });
    });

    test('extracts multiple path parameters', () => {
      router.get({ path: '/items/:itemId/sub/:subId', handler: vi.fn() });

      const result = router.match('GET', '/items/item-1/sub/sub-2');

      expect(result).not.toBeNull();
      expect(result?.params).toEqual({ itemId: 'item-1', subId: 'sub-2' });
    });

    test('does not match a partial path', () => {
      router.get({ path: '/items', handler: vi.fn() });

      const result = router.match('GET', '/items/extra');

      expect(result).toBeNull();
    });

    test('does not match a shorter path', () => {
      router.get({ path: '/items/:id', handler: vi.fn() });

      const result = router.match('GET', '/items');

      expect(result).toBeNull();
    });

    test('matches the correct method when multiple routes share the same path', () => {
      const getHandler = vi.fn();
      const postHandler = vi.fn();
      router.get({ path: '/items', handler: getHandler });
      router.post({ path: '/items', handler: postHandler });

      const getResult = router.match('GET', '/items');
      const postResult = router.match('POST', '/items');

      expect(getResult?.route.handler).toBe(getHandler);
      expect(postResult?.route.handler).toBe(postHandler);
    });

    test('returns the first match when multiple routes could match the same path', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      router.get({ path: '/items/:id', handler: firstHandler });
      router.get({ path: '/items/:slug', handler: secondHandler });

      const result = router.match('GET', '/items/abc');

      expect(result?.route.handler).toBe(firstHandler);
    });

    test('returns the handler reference from the matched route', () => {
      const handler = vi.fn();
      router.post({ path: '/items', handler });

      const result = router.match('POST', '/items');

      expect(result?.route.handler).toBe(handler);
    });

    test('matches all HTTP methods', () => {
      router.get({ path: '/a', handler: vi.fn() });
      router.head({ path: '/b', handler: vi.fn() });
      router.delete({ path: '/c', handler: vi.fn() });
      router.options({ path: '/d', handler: vi.fn() });
      router.post({ path: '/e', handler: vi.fn() });
      router.put({ path: '/f', handler: vi.fn() });
      router.patch({ path: '/g', handler: vi.fn() });

      expect(router.match('GET', '/a')).not.toBeNull();
      expect(router.match('HEAD', '/b')).not.toBeNull();
      expect(router.match('DELETE', '/c')).not.toBeNull();
      expect(router.match('OPTIONS', '/d')).not.toBeNull();
      expect(router.match('POST', '/e')).not.toBeNull();
      expect(router.match('PUT', '/f')).not.toBeNull();
      expect(router.match('PATCH', '/g')).not.toBeNull();
    });
  });
});

import { createMockSchema } from '@lambda-event-router/testing';

import { PathRouter } from './PathRouter.js';
import type { HTTPFilterInput } from './types.js';

function buildFilterInput(overrides: Partial<HTTPFilterInput> = {}): HTTPFilterInput {
  return {
    method: 'GET',
    path: '/items',
    headers: {},
    multiValueHeaders: {},
    query: {},
    multiValueQuery: {},
    body: undefined,
    auth: undefined,
    event: undefined,
    ...overrides,
  };
}

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

    test('ends a param name at the first character that cannot be in an identifier', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/files/:name.json');

      expect(result.pathParamNames).toEqual(['name']);
      expect(result.pattern.test('/files/report.json')).toBe(true);
      expect(result.pattern.test('/files/report.txt')).toBe(false);
    });

    test('allows letters, digits, underscore and dollar in a param name', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/items/:_item$Id2');

      expect(result.pathParamNames).toEqual(['_item$Id2']);
    });

    test('ends a param name at a non-ASCII character', () => {
      // @ts-expect-error - testing private method directly
      const result = router.compilePath('/:café');

      expect(result.pathParamNames).toEqual(['caf']);
      expect(result.pattern.test('/xé')).toBe(true);
    });

    test('throws when a param name starts with a digit', () => {
      // @ts-expect-error - testing private method directly
      expect(() => router.compilePath('/items/:1abc')).toThrow("Path '/items/:1abc' has a ':' without a param name");
    });

    test('throws when a colon has no param name after it', () => {
      // @ts-expect-error - testing private method directly
      expect(() => router.compilePath('/items/:')).toThrow("Path '/items/:' has a ':' without a param name");
      // @ts-expect-error - testing private method directly
      expect(() => router.compilePath('/items/:/sub')).toThrow("Path '/items/:/sub' has a ':' without a param name");
    });

    test('throws when a route is registered with a colon that has no param name', () => {
      // @ts-expect-error - '-' cannot start a param name
      expect(() => router.get({ filters: { path: '/items/:-' }, handler: vi.fn() })).toThrow(
        "Path '/items/:-' has a ':' without a param name",
      );
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

    test('extracts a param followed by a literal suffix in the same segment', async () => {
      router.get({ filters: { path: '/files/:name.json' }, handler: vi.fn() });

      const result = await router.match('GET', '/files/report.v2.json');

      expect(result?.params).toEqual({ name: 'report.v2' });
    });

    test('extracts a param that follows a literal prefix in the same segment', async () => {
      router.get({ filters: { path: '/api/v:version' }, handler: vi.fn() });

      expect((await router.match('GET', '/api/v2'))?.params).toEqual({ version: '2' });
      expect(await router.match('GET', '/api/x2')).toBeNull();
    });

    test('gives the extra text to the first of two params in one segment', async () => {
      router.get({ filters: { path: '/files/:name.:ext' }, handler: vi.fn() });
      router.get({ filters: { path: '/range/:from-:to' }, handler: vi.fn() });

      expect((await router.match('GET', '/files/a.b.json'))?.params).toEqual({ name: 'a.b', ext: 'json' });
      expect((await router.match('GET', '/range/a-b-c'))?.params).toEqual({ from: 'a-b', to: 'c' });
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

    test('skips route when custom returns false', async () => {
      router.get({
        filters: {
          path: '/items',
          custom: () => false,
        },
        handler: vi.fn(),
      });

      const result = await router.match('GET', '/items', buildFilterInput());

      expect(result).toBeNull();
    });

    test('matches route when custom returns true', async () => {
      const handler = vi.fn();
      router.get({
        filters: {
          path: '/items',
          custom: () => true,
        },
        handler,
      });

      const result = await router.match('GET', '/items', buildFilterInput());

      expect(result).not.toBeNull();
      expect(result?.route.handler).toBe(handler);
    });

    test('passes filterInput to custom', async () => {
      const custom = vi.fn().mockReturnValue(true);
      router.get({
        filters: { path: '/items', custom },
        handler: vi.fn(),
      });

      const filterInput = buildFilterInput({ headers: { authorization: 'Bearer token' } });
      await router.match('GET', '/items', filterInput);

      expect(custom).toHaveBeenCalledWith(filterInput);
    });

    test('falls through to next route when custom rejects first match', async () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();

      router.get({
        filters: {
          path: '/items',
          custom: () => false,
        },
        handler: firstHandler,
      });
      router.get({
        filters: { path: '/items' },
        handler: secondHandler,
      });

      const result = await router.match('GET', '/items', buildFilterInput());

      expect(result).not.toBeNull();
      expect(result?.route.handler).toBe(secondHandler);
    });

    test('does not call custom when method does not match', async () => {
      const custom = vi.fn();
      router.get({
        filters: { path: '/items', custom },
        handler: vi.fn(),
      });

      await router.match('POST', '/items', buildFilterInput());

      expect(custom).not.toHaveBeenCalled();
    });

    test('does not call custom when path does not match', async () => {
      const custom = vi.fn();
      router.get({
        filters: { path: '/items', custom },
        handler: vi.fn(),
      });

      await router.match('GET', '/other', buildFilterInput());

      expect(custom).not.toHaveBeenCalled();
    });
  });

  suite('specificity', () => {
    test('a param with a literal suffix beats a bare param at the same position, in either order', async () => {
      const suffixHandler = vi.fn();
      const paramHandler = vi.fn();
      const bareFirst = new PathRouter();
      bareFirst.get({ filters: { path: '/files/:id' }, handler: paramHandler });
      bareFirst.get({ filters: { path: '/files/:name.json' }, handler: suffixHandler });
      router.get({ filters: { path: '/files/:name.json' }, handler: suffixHandler });
      router.get({ filters: { path: '/files/:id' }, handler: paramHandler });

      for (const candidate of [bareFirst, router]) {
        expect((await candidate.match('GET', '/files/report.json'))?.route.handler).toBe(suffixHandler);
        expect((await candidate.match('GET', '/files/report'))?.route.handler).toBe(paramHandler);
      }
    });

    test('ranks a literal above a segment mixing literal and param, which ranks above a bare param', async () => {
      const literalHandler = vi.fn();
      const mixedHandler = vi.fn();
      const paramHandler = vi.fn();
      const paramFirst = new PathRouter();
      paramFirst.get({ filters: { path: '/:id' }, handler: paramHandler });
      paramFirst.get({ filters: { path: '/v:version' }, handler: mixedHandler });
      paramFirst.get({ filters: { path: '/v1' }, handler: literalHandler });
      router.get({ filters: { path: '/v1' }, handler: literalHandler });
      router.get({ filters: { path: '/v:version' }, handler: mixedHandler });
      router.get({ filters: { path: '/:id' }, handler: paramHandler });

      for (const candidate of [paramFirst, router]) {
        expect((await candidate.match('GET', '/v1'))?.route.handler).toBe(literalHandler);
        expect((await candidate.match('GET', '/v2'))?.route.handler).toBe(mixedHandler);
        expect((await candidate.match('GET', '/x2'))?.route.handler).toBe(paramHandler);
      }
    });

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

    test('keeps two routes of the same shape in registration order', async () => {
      const first = vi.fn();
      const second = vi.fn();
      router.get({ filters: { path: '/items/:id' }, handler: first });
      router.get({ filters: { path: '/items/:slug' }, handler: second });

      expect((await router.match('GET', '/items/1', buildFilterInput()))?.route.handler).toBe(first);
    });

    test('registers the same path twice without complaint', async () => {
      const first = vi.fn();
      const second = vi.fn();
      router.get({ filters: { path: '/items/latest' }, handler: first });
      router.get({ filters: { path: '/items/latest' }, handler: second });

      expect((await router.match('GET', '/items/latest', buildFilterInput()))?.route.handler).toBe(first);
    });

    test('keeps the same shape under a different method apart', async () => {
      const read = vi.fn();
      const write = vi.fn();
      router.get({ filters: { path: '/items/:id' }, handler: read });
      router.post({ filters: { path: '/items/:slug' }, handler: write });

      expect((await router.match('GET', '/items/1', buildFilterInput()))?.route.handler).toBe(read);
      expect((await router.match('POST', '/items/1', buildFilterInput()))?.route.handler).toBe(write);
    });

    test('ranks a guarded route ahead of the same shape without a custom, in either order', async () => {
      const guarded = vi.fn();
      const fallback = vi.fn();
      router.get({ filters: { path: '/items/:slug' }, handler: fallback });
      router.get({
        filters: { path: '/items/:id', custom: (input: HTTPFilterInput) => input.headers['x-route'] === 'guarded' },
        handler: guarded,
      });

      const guardedInput = buildFilterInput({ headers: { 'x-route': 'guarded' } });

      expect((await router.match('GET', '/items/1', guardedInput))?.route.handler).toBe(guarded);
      expect((await router.match('GET', '/items/1', buildFilterInput()))?.route.handler).toBe(fallback);
    });

    test('a route carrying a custom beats the same shape without one, fallback registered first', async () => {
      const guarded = vi.fn();
      const fallback = vi.fn();
      router.get({ filters: { path: '/items/:slug' }, handler: fallback });
      router.get({
        filters: { path: '/items/:id', custom: (input: HTTPFilterInput) => input.headers['x-route'] === 'guarded' },
        handler: guarded,
      });

      const guardedInput = buildFilterInput({ headers: { 'x-route': 'guarded' } });

      expect((await router.match('GET', '/items/1', guardedInput))?.route.handler).toBe(guarded);
      expect((await router.match('GET', '/items/1', buildFilterInput()))?.route.handler).toBe(fallback);
    });

    test('a more specific path beats a custom on a less specific one', async () => {
      const literal = vi.fn();
      const guardedParam = vi.fn();
      router.get({ filters: { path: '/orders/:orderId', custom: () => true }, handler: guardedParam });
      router.get({ filters: { path: '/orders/latest' }, handler: literal });

      expect((await router.match('GET', '/orders/latest', buildFilterInput()))?.route.handler).toBe(literal);
    });

    test('keeps two routes carrying a custom on the same shape in registration order, both ahead of one without', async () => {
      const plain = vi.fn();
      const first = vi.fn();
      const second = vi.fn();
      router.get({ filters: { path: '/items/:id' }, handler: plain });
      router.get({ filters: { path: '/items/:slug', custom: () => false }, handler: first });
      router.get({ filters: { path: '/items/:other', custom: () => true }, handler: second });

      expect((await router.match('GET', '/items/1', buildFilterInput()))?.route.handler).toBe(second);
    });

    test('ranks by path when routes of different lengths are registered alongside a custom', async () => {
      const oneParam = vi.fn();
      const paramThenLiteral = vi.fn();
      const literalThenParam = vi.fn();
      const twoParams = vi.fn();
      router.get({ filters: { path: '/:u' }, handler: oneParam });
      router.get({ filters: { path: '/:u/a' }, handler: paramThenLiteral });
      router.get({ filters: { path: '/b/:v', custom: () => true }, handler: literalThenParam });
      router.get({ filters: { path: '/:u/:id', custom: () => true }, handler: twoParams });

      expect((await router.match('GET', '/a/a', buildFilterInput()))?.route.handler).toBe(paramThenLiteral);
    });

    test('ranks a literal ahead of a param when a shorter path is registered between them', async () => {
      const param = vi.fn();
      const collection = vi.fn();
      const literal = vi.fn();
      router.get({ filters: { path: '/users/:id' }, handler: param });
      router.get({ filters: { path: '/users' }, handler: collection });
      router.get({ filters: { path: '/users/me' }, handler: literal });

      expect((await router.match('GET', '/users/me', buildFilterInput()))?.route.handler).toBe(literal);
      expect((await router.match('GET', '/users/99', buildFilterInput()))?.route.handler).toBe(param);
      expect((await router.match('GET', '/users', buildFilterInput()))?.route.handler).toBe(collection);
    });

    test('ranks routes of the same length against each other when a longer route sits between them', async () => {
      const plain = vi.fn();
      const longer = vi.fn();
      const guarded = vi.fn();
      router.get({ filters: { path: '/:x' }, handler: plain });
      router.get({ filters: { path: '/:y/:z', custom: () => true }, handler: longer });
      router.get({ filters: { path: '/:w', custom: () => true }, handler: guarded });

      expect((await router.match('GET', '/b', buildFilterInput()))?.route.handler).toBe(guarded);
    });
  });

  suite('getMethodsForPath', () => {
    test('ignores custom and returns methods based on path only', () => {
      router.get({
        filters: {
          path: '/items',
          custom: () => false,
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

    test('returns methods in registration order even when ranking moves the routes', async () => {
      router.get({ filters: { path: '/items' }, handler: vi.fn() });
      router.options({ filters: { path: '/items', custom: () => false }, handler: vi.fn() });

      await router.match('GET', '/items', buildFilterInput());

      expect(router.getMethodsForPath('/items')).toEqual(['GET', 'OPTIONS']);
    });
  });
});

import { createMockSchema } from '@lambda-event-router/testing';

import { PathRouter } from './PathRouter.js';
import { NoContent } from './Response.js';
import type { ApiRequest, HandlerResponse, HTTPFilterInput, PathParams } from './types.js';

interface Item {
  name: string;
}

type ItemsRequest<TBody> = ApiRequest<Record<never, never>, Record<string, string | undefined>, TBody>;

function readsTenant(input: HTTPFilterInput): boolean {
  return input.headers['x-tenant'] === 'acme';
}

function handlesUndefinedBody(_request: ItemsRequest<undefined>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

function handlesStringBody(_request: ItemsRequest<string>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

function handlesUnknownBody(_request: ItemsRequest<unknown>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

function handlesItemBody(_request: ItemsRequest<Item>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

suite('PathRouter convenience method filters', () => {
  let router: PathRouter;

  beforeEach(() => {
    router = new PathRouter();
  });

  test('types an inline custom on a method without a body', () => {
    const result = router.get({
      filters: {
        path: '/items',
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<HTTPFilterInput>();
          return true;
        },
      },
      handler: vi.fn(),
    });

    expect(result).toBe(router);
  });

  test('types an inline custom on a method with a body', () => {
    const result = router.post({
      filters: {
        path: '/items',
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        custom: (input) => {
          expectTypeOf(input).toEqualTypeOf<HTTPFilterInput>();
          return true;
        },
      },
      handler: vi.fn(),
    });

    expect(result).toBe(router);
  });

  test('accepts a custom declared with an annotated parameter', () => {
    router.get({ filters: { path: '/items', custom: readsTenant }, handler: vi.fn() });
    router.post({ filters: { path: '/items', custom: readsTenant }, handler: vi.fn() });

    expect(router.getMethodsForPath('/items')).toEqual(['GET', 'POST']);
  });
});

suite('PathRouter body types', () => {
  const filters = { path: '/items' };
  const bodySchema = createMockSchema<Item>();
  let router: PathRouter;

  beforeEach(() => {
    router = new PathRouter();
  });

  test('get(), head(), delete() and options() without a bodySchema type body as undefined', () => {
    router.get({ filters, handler: handlesUndefinedBody });
    router.head({ filters, handler: handlesUndefinedBody });
    router.delete({ filters, handler: handlesUndefinedBody });
    router.options({ filters, handler: handlesUndefinedBody });

    // @ts-expect-error - a GET route without a bodySchema has no body
    router.get({ filters, handler: handlesStringBody });
    // @ts-expect-error - a HEAD route without a bodySchema has no body
    router.head({ filters, handler: handlesStringBody });
    // @ts-expect-error - a DELETE route without a bodySchema has no body
    router.delete({ filters, handler: handlesStringBody });
    // @ts-expect-error - an OPTIONS route without a bodySchema has no body
    router.options({ filters, handler: handlesStringBody });
  });

  test('get(), head(), delete() and options() with a bodySchema type body as the schema output', () => {
    router.get({ filters, bodySchema, handler: handlesItemBody });
    router.head({ filters, bodySchema, handler: handlesItemBody });
    router.delete({ filters, bodySchema, handler: handlesItemBody });
    router.options({ filters, bodySchema, handler: handlesItemBody });

    // @ts-expect-error - the bodySchema output reaches the handler
    router.get({ filters, bodySchema, handler: handlesUndefinedBody });
  });

  test('route() with a method without a body and no bodySchema types body as undefined', () => {
    router.route({ filters: { method: 'GET', path: '/items' }, handler: handlesUndefinedBody });
    router.route({ filters: { method: 'get', path: '/items' }, handler: handlesUndefinedBody });

    // @ts-expect-error - a GET route without a bodySchema has no body
    router.route({ filters: { method: 'GET', path: '/items' }, handler: handlesStringBody });
    // @ts-expect-error - a lowercase get route without a bodySchema has no body
    router.route({ filters: { method: 'get', path: '/items' }, handler: handlesStringBody });
  });

  test('route() with a method with a body and no bodySchema types body as unknown', () => {
    router.route({ filters: { method: 'POST', path: '/items' }, handler: handlesUnknownBody });

    // @ts-expect-error - a POST route hands the handler whatever body arrives
    router.route({ filters: { method: 'POST', path: '/items' }, handler: handlesUndefinedBody });
  });

  test('route() with a bodySchema types body as the schema output on any method', () => {
    router.route({ filters: { method: 'GET', path: '/items' }, bodySchema, handler: handlesItemBody });
    router.route({ filters: { method: 'POST', path: '/items' }, bodySchema, handler: handlesItemBody });

    // @ts-expect-error - the bodySchema output reaches the handler
    router.route({ filters: { method: 'GET', path: '/items' }, bodySchema, handler: handlesUndefinedBody });
  });

  test('post() without a bodySchema types body as unknown', () => {
    router.post({ filters, handler: handlesUnknownBody });

    // @ts-expect-error - a POST route hands the handler whatever body arrives
    router.post({ filters, handler: handlesUndefinedBody });
  });

  test('a handler annotation does not set the body type', () => {
    // @ts-expect-error - only a bodySchema narrows the body, so an Item handler needs one
    router.post({ filters, handler: handlesItemBody });
  });
});

suite('PathParams', () => {
  test('ends a param name at the first character that cannot be in an identifier', () => {
    expectTypeOf<PathParams<'/files/:name.json'>>().toEqualTypeOf<{ name: string }>();
    expectTypeOf<PathParams<'/range/:from-:to'>>().toEqualTypeOf<{ from: string; to: string }>();
    expectTypeOf<PathParams<'/files/:name.:ext'>>().toEqualTypeOf<{ name: string; ext: string }>();
  });

  test('reads a param that follows a literal prefix in the same segment', () => {
    expectTypeOf<PathParams<'/api/v:version'>>().toEqualTypeOf<{ version: string }>();
  });

  test('allows letters, digits, underscore and dollar in a param name', () => {
    expectTypeOf<PathParams<'/items/:_item$Id2/sub/:subId'>>().toEqualTypeOf<{ _item$Id2: string; subId: string }>();
  });

  test('ends a param name at a non-ASCII character', () => {
    expectTypeOf<PathParams<'/:café'>>().toEqualTypeOf<{ caf: string }>();
  });

  test('gives no params for a literal path', () => {
    expectTypeOf<PathParams<'/items'>>().toEqualTypeOf<Record<never, never>>();
  });
});

suite('PathRouter path filter', () => {
  let router: PathRouter;

  beforeEach(() => {
    router = new PathRouter();
  });

  test('accepts a path whose params all have a name', () => {
    expect(router.get({ filters: { path: '/files/:name.json' }, handler: vi.fn() })).toBe(router);
  });

  test('accepts a path typed as a plain string', () => {
    const path: string = '/items/:id';

    expect(router.get({ filters: { path }, handler: vi.fn() })).toBe(router);
  });

  test('rejects a param name that starts with a digit', () => {
    expect(() =>
      router.get({
        // @ts-expect-error - '1abc' is not a param name
        filters: { path: '/items/:1abc' },
        handler: vi.fn(),
      }),
    ).toThrow("Path '/items/:1abc' has a ':' without a param name");
  });

  test('rejects a colon with no param name after it', () => {
    expect(() =>
      router.post({
        // @ts-expect-error - a ':' at the end of a path has no param name
        filters: { path: '/items/:' },
        handler: vi.fn(),
      }),
    ).toThrow("Path '/items/:' has a ':' without a param name");
  });

  test('rejects a bad param name on route()', () => {
    expect(() =>
      router.route({
        // @ts-expect-error - '-' cannot start a param name
        filters: { method: 'GET', path: '/items/:-' },
        handler: vi.fn(),
      }),
    ).toThrow("Path '/items/:-' has a ':' without a param name");
  });
});

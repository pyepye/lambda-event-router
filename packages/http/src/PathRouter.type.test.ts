import { createMockSchema } from '@latcher/testing';

import { PathRouter } from './PathRouter.js';
import { NoContent } from './Response.js';
import type { ApiRequest, HandlerResponse, HTTPFilterInput, PathParams } from './types.js';

interface Item {
  name: string;
}

type ItemsRequest<TBody> = ApiRequest<Record<never, never>, Record<string, string | undefined>, unknown, TBody>;

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
  let matcher: PathRouter;

  beforeEach(() => {
    matcher = new PathRouter();
  });

  test('types an inline custom on a method without a body', () => {
    const result = matcher.get({
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

    expect(result).toBe(matcher);
  });

  test('types an inline custom on a method with a body', () => {
    const result = matcher.post({
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

    expect(result).toBe(matcher);
  });

  test('accepts a custom declared with an annotated parameter', () => {
    matcher.get({ filters: { path: '/items', custom: readsTenant }, handler: vi.fn() });
    matcher.post({ filters: { path: '/items', custom: readsTenant }, handler: vi.fn() });

    expect(matcher.getMethodsForPath('/items')).toEqual(['GET', 'POST']);
  });
});

suite('PathRouter body types', () => {
  const filters = { path: '/items' };
  const bodySchema = createMockSchema<Item>();
  let matcher: PathRouter;

  beforeEach(() => {
    matcher = new PathRouter();
  });

  test('get(), head(), delete() and options() without a bodySchema type body as undefined', () => {
    matcher.get({ filters, handler: handlesUndefinedBody });
    matcher.head({ filters, handler: handlesUndefinedBody });
    matcher.delete({ filters, handler: handlesUndefinedBody });
    matcher.options({ filters, handler: handlesUndefinedBody });

    // @ts-expect-error - a GET route without a bodySchema has no body
    matcher.get({ filters, handler: handlesStringBody });
    // @ts-expect-error - a HEAD route without a bodySchema has no body
    matcher.head({ filters, handler: handlesStringBody });
    // @ts-expect-error - a DELETE route without a bodySchema has no body
    matcher.delete({ filters, handler: handlesStringBody });
    // @ts-expect-error - an OPTIONS route without a bodySchema has no body
    matcher.options({ filters, handler: handlesStringBody });
  });

  test('get(), head(), delete() and options() with a bodySchema type body as the schema output', () => {
    matcher.get({ filters, bodySchema, handler: handlesItemBody });
    matcher.head({ filters, bodySchema, handler: handlesItemBody });
    matcher.delete({ filters, bodySchema, handler: handlesItemBody });
    matcher.options({ filters, bodySchema, handler: handlesItemBody });

    // @ts-expect-error - the bodySchema output reaches the handler
    matcher.get({ filters, bodySchema, handler: handlesUndefinedBody });
  });

  test('route() with a method without a body and no bodySchema types body as undefined', () => {
    matcher.route({ filters: { method: 'GET', path: '/items' }, handler: handlesUndefinedBody });
    matcher.route({ filters: { method: 'get', path: '/items' }, handler: handlesUndefinedBody });

    // @ts-expect-error - a GET route without a bodySchema has no body
    matcher.route({ filters: { method: 'GET', path: '/items' }, handler: handlesStringBody });
    // @ts-expect-error - a lowercase get route without a bodySchema has no body
    matcher.route({ filters: { method: 'get', path: '/items' }, handler: handlesStringBody });
  });

  test('route() with a method with a body and no bodySchema types body as unknown', () => {
    matcher.route({ filters: { method: 'POST', path: '/items' }, handler: handlesUnknownBody });

    // @ts-expect-error - a POST route hands the handler whatever body arrives
    matcher.route({ filters: { method: 'POST', path: '/items' }, handler: handlesUndefinedBody });
  });

  test('route() with a bodySchema types body as the schema output on any method', () => {
    matcher.route({ filters: { method: 'GET', path: '/items' }, bodySchema, handler: handlesItemBody });
    matcher.route({ filters: { method: 'POST', path: '/items' }, bodySchema, handler: handlesItemBody });

    // @ts-expect-error - the bodySchema output reaches the handler
    matcher.route({ filters: { method: 'GET', path: '/items' }, bodySchema, handler: handlesUndefinedBody });
  });

  test('post() without a bodySchema types body as unknown', () => {
    matcher.post({ filters, handler: handlesUnknownBody });

    // @ts-expect-error - a POST route hands the handler whatever body arrives
    matcher.post({ filters, handler: handlesUndefinedBody });
  });

  test('a handler annotation does not set the body type', () => {
    // @ts-expect-error - only a bodySchema narrows the body, so an Item handler needs one
    matcher.post({ filters, handler: handlesItemBody });
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
  let matcher: PathRouter;

  beforeEach(() => {
    matcher = new PathRouter();
  });

  test('accepts a path whose params all have a name', () => {
    expect(matcher.get({ filters: { path: '/files/:name.json' }, handler: vi.fn() })).toBe(matcher);
  });

  test('accepts a path typed as a plain string', () => {
    const path: string = '/items/:id';

    expect(matcher.get({ filters: { path }, handler: vi.fn() })).toBe(matcher);
  });

  test('rejects a param name that starts with a digit', () => {
    expect(() =>
      matcher.get({
        // @ts-expect-error - '1abc' is not a param name
        filters: { path: '/items/:1abc' },
        handler: vi.fn(),
      }),
    ).toThrow("Path '/items/:1abc' has a ':' without a param name");
  });

  test('rejects a colon with no param name after it', () => {
    expect(() =>
      matcher.post({
        // @ts-expect-error - a ':' at the end of a path has no param name
        filters: { path: '/items/:' },
        handler: vi.fn(),
      }),
    ).toThrow("Path '/items/:' has a ':' without a param name");
  });

  test('rejects a bad param name on route()', () => {
    expect(() =>
      matcher.route({
        // @ts-expect-error - '-' cannot start a param name
        filters: { method: 'GET', path: '/items/:-' },
        handler: vi.fn(),
      }),
    ).toThrow("Path '/items/:-' has a ':' without a param name");
  });
});

import { createMockSchema } from '@lambda-event-router/testing';

import { createDefineRoute, defineRoute, HTTPRouter } from './HTTPRouter.js';
import { NoContent } from './Response.js';
import type {
  ApiHandler,
  ApiRequest,
  HandlerResponse,
  HTTPAdapter,
  HTTPFilterInput,
  HTTPMiddleware,
  NormalizedHTTPEvent,
} from './types.js';

interface Item {
  name: string;
}

type ItemsRequest<TBody> = ApiRequest<Record<never, never>, Record<string, string | undefined>, unknown, TBody>;

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

suite('defineRoute body types', () => {
  const bodySchema = createMockSchema<Item>();

  test('a method without a body and no bodySchema types body as undefined', () => {
    defineRoute({ filters: { method: 'GET', path: '/items' } }).handle(handlesUndefinedBody);

    // @ts-expect-error - a GET route without a bodySchema has no body
    defineRoute({ filters: { method: 'GET', path: '/items' } }).handle(handlesStringBody);
  });

  test('a method with a body and no bodySchema types body as unknown', () => {
    defineRoute({ filters: { method: 'POST', path: '/items' } }).handle(handlesUnknownBody);

    // @ts-expect-error - a POST route hands the handler whatever body arrives
    defineRoute({ filters: { method: 'POST', path: '/items' } }).handle(handlesUndefinedBody);
  });

  test('a bodySchema types body as the schema output on any method', () => {
    defineRoute({ filters: { method: 'GET', path: '/items' }, bodySchema }).handle(handlesItemBody);
    defineRoute({ filters: { method: 'POST', path: '/items' }, bodySchema }).handle(handlesItemBody);

    // @ts-expect-error - the bodySchema output reaches the handler
    defineRoute({ filters: { method: 'GET', path: '/items' }, bodySchema }).handle(handlesUndefinedBody);
  });
});

suite('defineRoute path filter', () => {
  test('accepts a path whose params all have a name', () => {
    defineRoute({ filters: { method: 'GET', path: '/files/:name.json' } }).handle(handlesUndefinedBody);
  });

  test('rejects a param name that starts with a digit', () => {
    // @ts-expect-error - '1abc' is not a param name
    defineRoute({ filters: { method: 'GET', path: '/items/:1abc' } });
  });
});

suite('HTTP generic order', () => {
  type Query = Record<string, string | undefined>;
  type ItemAuth = { principalId: string };

  test('ApiRequest takes auth after query and body after auth', () => {
    expectTypeOf<ApiRequest<{ id: string }, Query, ItemAuth, Item>['auth']>().toEqualTypeOf<ItemAuth>();
    expectTypeOf<ApiRequest<{ id: string }, Query, ItemAuth, Item>['body']>().toEqualTypeOf<Item>();
  });

  test('ApiRequest defaults auth to unknown, which each router package narrows', () => {
    expectTypeOf<ApiRequest<{ id: string }>['auth']>().toEqualTypeOf<unknown>();
  });

  test('ApiHandler and HTTPMiddleware take auth after query', () => {
    expectTypeOf<Parameters<ApiHandler<{ id: string }, Query, ItemAuth, Item>>[0]>().toEqualTypeOf<
      ApiRequest<{ id: string }, Query, ItemAuth, Item>
    >();
    expectTypeOf<Parameters<HTTPMiddleware<{ id: string }, Query, ItemAuth, Item>>[0]>().toEqualTypeOf<
      ApiRequest<{ id: string }, Query, ItemAuth, Item>
    >();
  });
});

type TeamAuth = { type: 'team'; team: string } | undefined;
type TeamRequest = ApiRequest<Record<string, string>, Record<string, string | undefined>, TeamAuth>;

const teamAdapter: HTTPAdapter<unknown, unknown, TeamAuth> = {
  canHandleEvent: (event: unknown): event is unknown => event !== undefined,
  normalize: (): NormalizedHTTPEvent<TeamAuth> => ({
    method: 'GET',
    path: '/items',
    headers: {},
    multiValueHeaders: {},
    query: {},
    multiValueQuery: {},
    body: undefined,
    isBase64Encoded: false,
    auth: { type: 'team', team: 'goods-in' },
  }),
  buildResult: (): unknown => undefined,
};

function readsTeam(input: HTTPFilterInput<unknown, TeamAuth>): boolean {
  return input.auth?.team === 'goods-in';
}

function handlesTeamAuth(_request: TeamRequest): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

suite('auth type', () => {
  test('a router hands its adapter auth type to the handler and the custom filter', () => {
    const router = new HTTPRouter(teamAdapter);

    router.get({ filters: { path: '/items', custom: readsTeam }, handler: handlesTeamAuth });
    router.route({ filters: { method: 'POST', path: '/items', custom: readsTeam }, handler: handlesTeamAuth });
  });

  test('a router with unknown auth rejects a handler that expects an auth type', () => {
    const router = new HTTPRouter<unknown, unknown>(teamAdapter);

    // @ts-expect-error - the router does not promise TeamAuth
    router.get({ filters: { path: '/items' }, handler: handlesTeamAuth });
    // @ts-expect-error - the router does not promise TeamAuth to a custom filter either
    router.get({ filters: { path: '/items', custom: readsTeam }, handler: vi.fn() });
  });

  test('createDefineRoute types auth for the routes it defines', () => {
    createDefineRoute<TeamAuth>()({ filters: { method: 'GET', path: '/items' } }).handle(handlesTeamAuth);

    // @ts-expect-error - a route defined with unknown auth does not promise TeamAuth
    createDefineRoute<unknown>()({ filters: { method: 'GET', path: '/items' } }).handle(handlesTeamAuth);
  });

  test('a route defined for one auth type registers on a router with that auth type', () => {
    const router = new HTTPRouter(teamAdapter);
    const itemsRoute = createDefineRoute<TeamAuth>()({ filters: { method: 'GET', path: '/items' } }).handle(
      handlesTeamAuth,
    );

    router.route(itemsRoute);
  });
});

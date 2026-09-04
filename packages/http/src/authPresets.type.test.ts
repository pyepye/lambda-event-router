import { type AuthOf, type AuthPreset, noAuth } from './auth.js';
import { createDefineRoute, HTTPRouter } from './HTTPRouter.js';
import { NoContent } from './Response.js';
import type { ApiRequest, HandlerResponse, HTTPAdapter, NormalizedHTTPEvent } from './types.js';

type TeamAuth = { type: 'team'; team: string };
type OrgAuth = { type: 'org'; org: string };
type RawAuth = TeamAuth | OrgAuth | undefined;
type Query = Record<string, string | undefined>;

const rawAdapter: HTTPAdapter<unknown, unknown, RawAuth> = {
  canHandleEvent: (event: unknown): event is unknown => event !== undefined,
  normalize: (): NormalizedHTTPEvent<RawAuth> => ({
    method: 'GET',
    path: '/items',
    headers: {},
    multiValueHeaders: {},
    query: {},
    multiValueQuery: {},
    body: undefined,
    isBase64Encoded: false,
    auth: undefined,
  }),
  buildResult: (): unknown => undefined,
};

const teamOnly: AuthPreset<RawAuth, TeamAuth> = {
  name: 'teamOnly',
  check: async () => ({ success: true, auth: { type: 'team', team: 'goods-in' } }),
};

const orgOnly: AuthPreset<RawAuth, OrgAuth> = {
  name: 'orgOnly',
  check: async () => ({ success: true, auth: { type: 'org', org: 'acme' } }),
};

const otherRawPreset: AuthPreset<{ type: 'other' }, { type: 'other' }> = {
  name: 'otherRawPreset',
  check: async (auth: { type: 'other' }) => ({ success: true, auth }),
};

function handlesTeam(_request: ApiRequest<Record<string, string>, Query, TeamAuth>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

function handlesOrg(_request: ApiRequest<Record<string, string>, Query, OrgAuth>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

function handlesNoAuth(_request: ApiRequest<Record<string, string>, Query, undefined>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

function handlesRawAuth(_request: ApiRequest<Record<string, string>, Query, RawAuth>): Promise<HandlerResponse> {
  return Promise.resolve(NoContent());
}

function makeRouter(): HTTPRouter<unknown, unknown, RawAuth> {
  return new HTTPRouter(rawAdapter);
}

function makeTeamRouter(): HTTPRouter<unknown, unknown, RawAuth, TeamAuth> {
  return new HTTPRouter({ adapter: rawAdapter, auth: teamOnly });
}

suite('auth preset types', () => {
  test('AuthOf reads the auth a preset hands on', () => {
    expectTypeOf<AuthOf<typeof teamOnly>>().toEqualTypeOf<TeamAuth>();
    expectTypeOf<AuthOf<ReturnType<typeof noAuth<RawAuth>>>>().toEqualTypeOf<undefined>();
  });

  test('a route preset types the handler auth', () => {
    makeRouter().get({ filters: { path: '/items' }, auth: teamOnly, handler: handlesTeam });
    makeRouter().route({ filters: { method: 'POST', path: '/items' }, auth: orgOnly, handler: handlesOrg });

    // @ts-expect-error - teamOnly hands on TeamAuth, not OrgAuth
    makeRouter().get({ filters: { path: '/items' }, auth: teamOnly, handler: handlesOrg });
  });

  test('a route with no preset and no router default gives the adapter auth', () => {
    makeRouter().get({ filters: { path: '/items' }, handler: handlesRawAuth });

    // @ts-expect-error - nothing checks the auth, so the handler cannot assume TeamAuth
    makeRouter().get({ filters: { path: '/items' }, handler: handlesTeam });
  });

  test('a router default types a route with no preset', () => {
    makeTeamRouter().get({ filters: { path: '/items' }, handler: handlesTeam });
    makeTeamRouter().get({ filters: { path: '/items' }, handler: handlesRawAuth });

    // @ts-expect-error - the default hands on TeamAuth, not OrgAuth
    makeTeamRouter().get({ filters: { path: '/items' }, handler: handlesOrg });
  });

  test('a route preset overrides the router default', () => {
    makeTeamRouter().get({ filters: { path: '/items' }, auth: orgOnly, handler: handlesOrg });
    makeTeamRouter().get({ filters: { path: '/health' }, auth: noAuth(), handler: handlesNoAuth });

    // @ts-expect-error - a noAuth route hands on undefined, not TeamAuth
    makeTeamRouter().get({ filters: { path: '/health' }, auth: noAuth(), handler: handlesTeam });
  });

  test('a preset built for another adapter is refused', () => {
    // @ts-expect-error - the preset checks a different auth type from the one this adapter produces
    makeRouter().get({ filters: { path: '/items' }, auth: otherRawPreset, handler: vi.fn() });
  });

  test('the router defineRoute uses the router default', () => {
    const itemsRoute = makeTeamRouter()
      .defineRoute({ filters: { method: 'GET', path: '/items' } })
      .handle(handlesTeam);
    makeTeamRouter().route(itemsRoute);

    const untypedBuilder = makeRouter().defineRoute({ filters: { method: 'GET', path: '/items' } });
    // @ts-expect-error - a router with no default does not promise TeamAuth
    untypedBuilder.handle(handlesTeam);
  });

  test('a route defined without a preset registers on a router with a default', () => {
    const itemsRoute = createDefineRoute<RawAuth>()({ filters: { method: 'GET', path: '/items' } }).handle(
      handlesRawAuth,
    );

    makeTeamRouter().route(itemsRoute);
  });

  test('a route defined with a preset keeps that preset type', () => {
    const itemsRoute = createDefineRoute<RawAuth>()({
      filters: { method: 'GET', path: '/items' },
      auth: orgOnly,
    }).handle(handlesOrg);

    makeTeamRouter().route(itemsRoute);
  });
});

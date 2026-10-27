import { type AuthOf, type AuthPreset, noAuth } from './auth.js';
import { createDefineRoute, HTTPMatcher } from './HTTPMatcher.js';
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

function makeMatcher(): HTTPMatcher<unknown, unknown, RawAuth> {
  return new HTTPMatcher(rawAdapter);
}

function makeTeamMatcher(): HTTPMatcher<unknown, unknown, RawAuth, TeamAuth> {
  return new HTTPMatcher({ adapter: rawAdapter, auth: teamOnly });
}

suite('auth preset types', () => {
  test('AuthOf reads the auth a preset hands on', () => {
    expectTypeOf<AuthOf<typeof teamOnly>>().toEqualTypeOf<TeamAuth>();
    expectTypeOf<AuthOf<ReturnType<typeof noAuth<RawAuth>>>>().toEqualTypeOf<undefined>();
  });

  test('a route preset types the handler auth', () => {
    makeMatcher().get({ filters: { path: '/items' }, auth: teamOnly, handler: handlesTeam });
    makeMatcher().route({ filters: { method: 'POST', path: '/items' }, auth: orgOnly, handler: handlesOrg });

    // @ts-expect-error - teamOnly hands on TeamAuth, not OrgAuth
    makeMatcher().get({ filters: { path: '/items' }, auth: teamOnly, handler: handlesOrg });
  });

  test('a route with no preset and no matcher default gives the adapter auth', () => {
    makeMatcher().get({ filters: { path: '/items' }, handler: handlesRawAuth });

    // @ts-expect-error - nothing checks the auth, so the handler cannot assume TeamAuth
    makeMatcher().get({ filters: { path: '/items' }, handler: handlesTeam });
  });

  test('a matcher default types a route with no preset', () => {
    makeTeamMatcher().get({ filters: { path: '/items' }, handler: handlesTeam });
    makeTeamMatcher().get({ filters: { path: '/items' }, handler: handlesRawAuth });

    // @ts-expect-error - the default hands on TeamAuth, not OrgAuth
    makeTeamMatcher().get({ filters: { path: '/items' }, handler: handlesOrg });
  });

  test('a route preset overrides the matcher default', () => {
    makeTeamMatcher().get({ filters: { path: '/items' }, auth: orgOnly, handler: handlesOrg });
    makeTeamMatcher().get({ filters: { path: '/health' }, auth: noAuth(), handler: handlesNoAuth });

    // @ts-expect-error - a noAuth route hands on undefined, not TeamAuth
    makeTeamMatcher().get({ filters: { path: '/health' }, auth: noAuth(), handler: handlesTeam });
  });

  test('a preset built for another adapter is refused', () => {
    // @ts-expect-error - the preset checks a different auth type from the one this adapter produces
    makeMatcher().get({ filters: { path: '/items' }, auth: otherRawPreset, handler: vi.fn() });
  });

  test('the matcher defineRoute uses the matcher default', () => {
    const itemsRoute = makeTeamMatcher()
      .defineRoute({ filters: { method: 'GET', path: '/items' } })
      .handle(handlesTeam);
    makeTeamMatcher().route(itemsRoute);

    const untypedBuilder = makeMatcher().defineRoute({ filters: { method: 'GET', path: '/items' } });
    // @ts-expect-error - a matcher with no default does not promise TeamAuth
    untypedBuilder.handle(handlesTeam);
  });

  test('a route defined without a preset registers on a matcher with a default', () => {
    const itemsRoute = createDefineRoute<RawAuth>()({ filters: { method: 'GET', path: '/items' } }).handle(
      handlesRawAuth,
    );

    makeTeamMatcher().route(itemsRoute);
  });

  test('a route defined with a preset keeps that preset type', () => {
    const itemsRoute = createDefineRoute<RawAuth>()({
      filters: { method: 'GET', path: '/items' },
      auth: orgOnly,
    }).handle(handlesOrg);

    makeTeamMatcher().route(itemsRoute);
  });
});

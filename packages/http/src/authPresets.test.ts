import { getLogger } from '@lambda-event-router/base';
import { createMockContext, createMockSchema } from '@lambda-event-router/testing';

import { type AuthPreset, noAuth } from './auth.js';
import { HTTPRouter } from './HTTPRouter.js';
import type {
  ApiRequest,
  FinalizedHTTPResponse,
  HandlerResponse,
  HTTPAdapter,
  NormalizedHTTPEvent,
  PathParams,
  ResponseBody,
} from './types.js';

type TeamAuth = { type: 'team'; team: string };
type OrgAuth = { type: 'org'; org: string };
type RawAuth = TeamAuth | OrgAuth | undefined;
type Query = Record<string, string | undefined>;
type RouterRequest = ApiRequest<Record<string, string>, Query, RawAuth>;
type ItemsRequest = ApiRequest<PathParams<'/items'>, Query, TeamAuth, undefined>;

interface TeamEvent {
  method: string;
  path: string;
  auth: RawAuth;
  body?: string;
}

const teamAdapter: HTTPAdapter<TeamEvent, FinalizedHTTPResponse, RawAuth> = {
  canHandleEvent: (event: unknown): event is TeamEvent => typeof event === 'object' && event !== null,
  normalize: (event: TeamEvent): NormalizedHTTPEvent<RawAuth> => ({
    method: event.method,
    path: event.path,
    headers: { 'content-type': 'application/json' },
    multiValueHeaders: {},
    query: {},
    multiValueQuery: {},
    body: event.body,
    isBase64Encoded: false,
    auth: event.auth,
  }),
  buildResult: (response: FinalizedHTTPResponse): FinalizedHTTPResponse => response,
};

const teamOnly: AuthPreset<RawAuth, TeamAuth> = {
  name: 'teamOnly',
  check: async (auth: RawAuth) => {
    if (auth === undefined) return { success: false, reason: 'missing', message: 'expected team auth, got none' };
    if (auth.type !== 'team') return { success: false, reason: 'wrongType', message: 'expected team auth' };
    if (auth.team === '') return { success: false, reason: 'invalid', message: 'team is empty' };
    return { success: true, auth };
  },
};

const orgOnly: AuthPreset<RawAuth, OrgAuth> = {
  name: 'orgOnly',
  check: async (auth: RawAuth) =>
    auth?.type === 'org'
      ? { success: true, auth }
      : { success: false, reason: 'wrongType', message: 'expected org auth' },
};

const TEAM: TeamAuth = { type: 'team', team: 'goods-in' };
const ORG: OrgAuth = { type: 'org', org: 'acme' };

function request(auth: RawAuth, method: string = 'GET', body?: string): TeamEvent {
  return { method, path: '/items', auth, body };
}

suite('auth presets', () => {
  const context = createMockContext();

  test('a route preset hands the handler the auth its check returns', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const router = new HTTPRouter(teamAdapter).get({ filters: { path: '/items' }, auth: teamOnly, handler });

    const result = await router.handleEvent(request(TEAM), context);

    expect(result.statusCode).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ auth: TEAM }));
  });

  test('a request with the wrong auth type answers 500 and logs why, without running the handler', async () => {
    const errorSpy = vi.spyOn(getLogger(), 'error').mockImplementation(() => undefined);
    const handler = vi.fn();
    const router = new HTTPRouter(teamAdapter).get({ filters: { path: '/items' }, auth: teamOnly, handler });

    const result = await router.handleEvent(request(ORG), context);

    expect(result.statusCode).toBe(500);
    expect(handler).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Request auth does not match the auth preset',
      expect.objectContaining({ preset: 'teamOnly', reason: 'wrongType', message: 'expected team auth' }),
    );
    errorSpy.mockRestore();
  });

  test('a request with no auth answers 401 and logs a warning', async () => {
    const warnSpy = vi.spyOn(getLogger(), 'warn').mockImplementation(() => undefined);
    const router = new HTTPRouter(teamAdapter).get({ filters: { path: '/items' }, auth: teamOnly, handler: vi.fn() });

    const result = await router.handleEvent(request(undefined), context);

    expect(result.statusCode).toBe(401);
    expect(result.body).toBe(JSON.stringify({ error: 'Unauthorised' }));
    expect(warnSpy).toHaveBeenCalledWith(
      'Request auth does not match the auth preset',
      expect.objectContaining({ preset: 'teamOnly', reason: 'missing' }),
    );
    warnSpy.mockRestore();
  });

  test('a request whose auth fails its check answers 403 and logs a warning', async () => {
    const warnSpy = vi.spyOn(getLogger(), 'warn').mockImplementation(() => undefined);
    const router = new HTTPRouter(teamAdapter).get({ filters: { path: '/items' }, auth: teamOnly, handler: vi.fn() });

    const result = await router.handleEvent(request({ type: 'team', team: '' }), context);

    expect(result.statusCode).toBe(403);
    expect(result.body).toBe(JSON.stringify({ error: 'Forbidden' }));
    expect(warnSpy).toHaveBeenCalledWith(
      'Request auth does not match the auth preset',
      expect.objectContaining({ preset: 'teamOnly', reason: 'invalid', message: 'team is empty' }),
    );
    warnSpy.mockRestore();
  });

  test('a router default applies to a route with no preset', async () => {
    const errorSpy = vi.spyOn(getLogger(), 'error').mockImplementation(() => undefined);
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const router = new HTTPRouter({ adapter: teamAdapter, auth: teamOnly }).get({
      filters: { path: '/items' },
      handler,
    });

    const allowed = await router.handleEvent(request(TEAM), context);
    const refused = await router.handleEvent(request(ORG), context);

    expect(allowed.statusCode).toBe(200);
    expect(refused.statusCode).toBe(500);
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  test('a route preset overrides the router default', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const router = new HTTPRouter({ adapter: teamAdapter, auth: teamOnly }).get({
      filters: { path: '/items' },
      auth: orgOnly,
      handler,
    });

    const result = await router.handleEvent(request(ORG), context);

    expect(result.statusCode).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ auth: ORG }));
  });

  test('noAuth hands the handler undefined and logs a warning when auth arrives', async () => {
    const warnSpy = vi.spyOn(getLogger(), 'warn').mockImplementation(() => undefined);
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const router = new HTTPRouter({ adapter: teamAdapter, auth: teamOnly }).get({
      filters: { path: '/items' },
      auth: noAuth(),
      handler,
    });

    const result = await router.handleEvent(request(TEAM), context);

    expect(result.statusCode).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ auth: undefined }));
    expect(warnSpy).toHaveBeenCalledWith('A noAuth route received auth, which its handler does not see', {
      authType: 'team',
    });
    warnSpy.mockRestore();
  });

  test('noAuth logs nothing when no auth arrives', async () => {
    const warnSpy = vi.spyOn(getLogger(), 'warn').mockImplementation(() => undefined);
    const router = new HTTPRouter(teamAdapter).get({
      filters: { path: '/items' },
      auth: noAuth(),
      handler: vi.fn().mockResolvedValue({ ok: true }),
    });

    await router.handleEvent(request(undefined), context);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('the auth check runs before the body is validated', async () => {
    const errorSpy = vi.spyOn(getLogger(), 'error').mockImplementation(() => undefined);
    const bodySchema = createMockSchema<{ name: string }>({ issues: [{ message: 'name is required' }] });
    const router = new HTTPRouter(teamAdapter).post({
      filters: { path: '/items' },
      auth: teamOnly,
      bodySchema,
      handler: vi.fn(),
    });

    const result = await router.handleEvent(request(ORG, 'POST', '{}'), context);

    expect(result.statusCode).toBe(500);
    errorSpy.mockRestore();
  });

  test('router and route middleware see the checked auth', async () => {
    const seen: unknown[] = [];
    const checkedAuth: TeamAuth = { type: 'team', team: 'checked' };
    const rewritesTeam: AuthPreset<RawAuth, TeamAuth> = {
      name: 'rewritesTeam',
      check: async () => ({ success: true, auth: checkedAuth }),
    };
    const router = new HTTPRouter({
      adapter: teamAdapter,
      middleware: [
        async (
          req: RouterRequest,
          next: (req: RouterRequest) => Promise<HandlerResponse<ResponseBody>>,
        ): Promise<HandlerResponse<ResponseBody>> => {
          seen.push(req.auth);
          return next(req);
        },
      ],
    }).get({
      filters: { path: '/items' },
      auth: rewritesTeam,
      middleware: [
        async (req: ItemsRequest, next: (req: ItemsRequest) => Promise<HandlerResponse>): Promise<HandlerResponse> => {
          seen.push(req.auth);
          return next(req);
        },
      ],
      handler: vi.fn().mockResolvedValue({ ok: true }),
    });

    await router.handleEvent(request(TEAM), context);

    expect(seen).toEqual([checkedAuth, checkedAuth]);
  });

  test('a custom filter sees the auth as the adapter produced it', async () => {
    const custom = vi.fn().mockReturnValue(true);
    const router = new HTTPRouter(teamAdapter).get({
      filters: { path: '/items', custom },
      auth: noAuth(),
      handler: vi.fn().mockResolvedValue({ ok: true }),
    });
    const warnSpy = vi.spyOn(getLogger(), 'warn').mockImplementation(() => undefined);

    await router.handleEvent(request(TEAM), context);

    expect(custom).toHaveBeenCalledWith(expect.objectContaining({ auth: TEAM }));
    warnSpy.mockRestore();
  });

  test('a route with no preset on a router with no default gets the auth the adapter produced', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const router = new HTTPRouter(teamAdapter).get({ filters: { path: '/items' }, handler });

    await router.handleEvent(request(ORG), context);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ auth: ORG }));
  });

  test('a route from the router defineRoute uses the router default', async () => {
    const errorSpy = vi.spyOn(getLogger(), 'error').mockImplementation(() => undefined);
    const router = new HTTPRouter({ adapter: teamAdapter, auth: teamOnly });
    const itemsRoute = router
      .defineRoute({ filters: { method: 'GET', path: '/items' } })
      .handle(async ({ auth }) => ({ team: auth.team }));
    router.route(itemsRoute);

    const allowed = await router.handleEvent(request(TEAM), context);
    const refused = await router.handleEvent(request(ORG), context);

    expect(allowed.body).toBe(JSON.stringify({ team: 'goods-in' }));
    expect(refused.statusCode).toBe(500);
    errorSpy.mockRestore();
  });
});

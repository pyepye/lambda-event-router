import { createMockSchema } from '@lambda-event-router/testing';

import { HTTP_STATUS_CODES } from './constants.js';
import { HTTPException } from './HTTPException.js';
import { createDefineRoute, defineRoute, HTTPRouter } from './HTTPRouter.js';
import { Html } from './html.js';
import { Conflict, Created, NoContent, NotFound, Ok, Response } from './Response.js';
import type {
  ApiHandler,
  ApiRequest,
  Bytes,
  ErrorContext,
  ErrorInput,
  ErrorStatusCode,
  HandlerResponse,
  HTTPAdapter,
  HTTPFilterInput,
  HTTPMiddleware,
  JsonBody,
  NormalizedHTTPEvent,
  PathParams,
  ResponseBody,
  RouteDefinition,
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

interface Order {
  orderId: string;
  lines: { sku: string; quantity: number }[];
}

const order: Order = { orderId: 'ord-1', lines: [{ sku: 'brk-9', quantity: 2 }] };

type OrderRequest = ApiRequest<Record<string, string>, Record<string, string | undefined>, unknown, undefined>;

function handlesWithDefaultResponse(_request: OrderRequest): Promise<HandlerResponse> {
  return Promise.resolve(order);
}

suite('JSON route response types', () => {
  const router = new HTTPRouter(teamAdapter);

  test('rejects a string on a JSON route', () => {
    // @ts-expect-error - a JSON route sends a JSON body, not a string
    router.get({ filters: { path: '/orders' }, handler: async () => 'ok' });
    // @ts-expect-error - a JSON route sends a JSON body, not a string
    defineRoute({ filters: { method: 'GET', path: '/orders' } }).handle(async () => 'ok');
  });

  test('rejects JSON.stringify output on a JSON route', () => {
    // @ts-expect-error - the router encodes the body, so encoding it first sends it twice
    router.get({ filters: { path: '/orders' }, handler: async () => JSON.stringify(order) });
  });

  test('rejects a number or a boolean on a JSON route', () => {
    // @ts-expect-error - a JSON route sends a JSON body, not a number
    router.get({ filters: { path: '/orders' }, handler: async () => 42 });
    // @ts-expect-error - a JSON route sends a JSON body, not a boolean
    router.get({ filters: { path: '/orders' }, handler: async () => true });
  });

  test('rejects Ok with a string on a JSON route', () => {
    // @ts-expect-error - Ok on a JSON route takes a JSON body, not a string
    router.get({ filters: { path: '/orders' }, handler: async () => Ok('ok') });
    // @ts-expect-error - Ok on a JSON route takes a JSON body, not a string
    defineRoute({ filters: { method: 'GET', path: '/orders' } }).handle(async () => Ok('ok'));
  });

  test('rejects a statusCode object with no body on a JSON route', () => {
    // @ts-expect-error - an object with a statusCode reads as a response, so it must carry a body
    router.get({ filters: { path: '/orders' }, handler: async () => ({ statusCode: 200 }) });
  });

  test('accepts an object literal on a JSON route', () => {
    router.get({ filters: { path: '/orders' }, handler: async () => ({ orderId: 'ord-1' }) });
    defineRoute({ filters: { method: 'GET', path: '/orders' } }).handle(async () => ({ orderId: 'ord-1' }));
  });

  test('accepts a nested object literal on a JSON route', () => {
    router.get({
      filters: { path: '/orders' },
      handler: async () => ({ order: { orderId: 'ord-1', lines: [{ sku: 'brk-9' }] } }),
    });
  });

  test('accepts an interface value on a JSON route', () => {
    router.get({ filters: { path: '/orders' }, handler: async () => order });
    defineRoute({ filters: { method: 'GET', path: '/orders' } }).handle(async () => order);
  });

  test('accepts an array on a JSON route', () => {
    router.get({ filters: { path: '/orders' }, handler: async () => [order] });
  });

  test('accepts Ok with an interface value on a JSON route', () => {
    router.get({ filters: { path: '/orders' }, handler: async () => Ok(order) });
    defineRoute({ filters: { method: 'GET', path: '/orders' } }).handle(async () => Ok(order));
  });

  test('accepts undefined on a JSON route', () => {
    router.get({ filters: { path: '/orders' }, handler: async () => undefined });
  });

  test('accepts a handler that returns nothing on a JSON route', () => {
    router.delete({ filters: { path: '/orders' }, handler: async () => {} });
    defineRoute({ filters: { method: 'DELETE', path: '/orders' } }).handle(async () => {});
  });

  test('accepts a full ApiResponse on a JSON route', () => {
    router.get({
      filters: { path: '/orders' },
      handler: async () => ({ statusCode: 202, body: order, headers: { 'x-queue': 'orders' } }),
    });
  });

  test('accepts a returned error helper on a JSON route', () => {
    router.get({ filters: { path: '/orders' }, handler: async () => Conflict('Order is locked') });
  });

  test('accepts a returned HTTPException on a JSON route', () => {
    router.get({ filters: { path: '/orders' }, handler: async () => new HTTPException(429) });
  });

  test('rejects a string responseSchema on a JSON route', () => {
    const responseSchema = createMockSchema<string>();

    // @ts-expect-error - a JSON route's responseSchema must output a JSON body
    router.get({ filters: { path: '/orders' }, responseSchema, handler: async () => 'ok' });
    // @ts-expect-error - a JSON route's responseSchema must output a JSON body
    defineRoute({ filters: { method: 'GET', path: '/orders' }, responseSchema });
  });

  test('types the handler from an object responseSchema on a JSON route', () => {
    const responseSchema = createMockSchema<Order>();

    router.get({ filters: { path: '/orders' }, responseSchema, handler: async () => order });
    // @ts-expect-error - the handler must return the responseSchema output
    router.get({ filters: { path: '/orders' }, responseSchema, handler: async () => ({ sku: 'brk-9' }) });
  });

  test('accepts a default HandlerResponse handler on a JSON route', () => {
    router.get({ filters: { path: '/orders' }, handler: handlesWithDefaultResponse });
    defineRoute({ filters: { method: 'GET', path: '/orders' } }).handle(handlesWithDefaultResponse);
  });

  test('rejects a handler that returns nothing when the responseSchema needs a body', () => {
    const responseSchema = createMockSchema<Order>();

    // @ts-expect-error - the responseSchema needs an Order, so the handler must return one
    router.delete({ filters: { path: '/orders' }, responseSchema, handler: async () => {} });
    // @ts-expect-error - the responseSchema needs an Order, so the handler must return one
    defineRoute({ filters: { method: 'DELETE', path: '/orders' }, responseSchema }).handle(async () => {});
    // @ts-expect-error - the responseSchema needs an Order, so the handler must return one
    router.route({ filters: { method: 'DELETE', path: '/orders' }, responseSchema, handler: async () => {} });
  });

  test('accepts a handler that returns nothing when the responseSchema accepts undefined', () => {
    const responseSchema = createMockSchema<Order | undefined>();

    router.delete({ filters: { path: '/orders' }, responseSchema, handler: async () => {} });
    defineRoute({ filters: { method: 'DELETE', path: '/orders' }, responseSchema }).handle(async () => {});
  });

  test('HandlerResponse defaults to a JSON body', () => {
    expectTypeOf<string>().not.toExtend<HandlerResponse>();
    expectTypeOf<Order>().toExtend<HandlerResponse>();
  });
});

suite('HTTPException status codes', () => {
  test('accepts a 4xx or 5xx number or enum member', () => {
    expectTypeOf(new HTTPException(404).statusCode).toEqualTypeOf<ErrorStatusCode>();
    expectTypeOf(new HTTPException(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE).statusCode).toEqualTypeOf<ErrorStatusCode>();
  });

  test('rejects an HTTPException with a 2xx status', () => {
    // @ts-expect-error - an HTTPException is an error, so it takes a 4xx or 5xx status
    expect(() => new HTTPException(200)).toThrow(RangeError);
    // @ts-expect-error - an HTTPException is an error, so it takes a 4xx or 5xx status
    expect(() => new HTTPException(HTTP_STATUS_CODES.OK)).toThrow(RangeError);
  });

  test('rejects a status typed as a plain number', () => {
    const statusCode: number = 404;

    // @ts-expect-error - a plain number might not be 4xx or 5xx
    expect(new HTTPException(statusCode).statusCode).toBe(404);
  });
});

suite('error helper types', () => {
  test('accepts a message, a JSON context and headers on an error helper', () => {
    NotFound();
    NotFound('Could not find order ord-1');
    NotFound('Could not find order ord-1', { orderId: 'ord-1', lines: [{ sku: 'brk-9' }] });
    NotFound('Could not find order ord-1', ['ord-1', 'ord-2']);
    NotFound(undefined, 'ord-1');
    NotFound(undefined, 404);
    NotFound(undefined, null, { 'retry-after': '30' });
    new HTTPException(429, 'Slow down', { retryAfter: 30 }, { 'retry-after': '30' });
  });

  test('accepts an interface value as a context', () => {
    NotFound('Could not find order ord-1', order);
  });

  test('rejects a context that JSON cannot carry', () => {
    // @ts-expect-error - JSON.stringify sends a Map as {}, so its entries would be lost
    NotFound('Could not find order ord-1', new Map([['orderId', 'ord-1']]));
    // @ts-expect-error - bytes are not a JSON value
    NotFound('Could not find order ord-1', new Uint8Array());
  });

  test('rejects a message that is not a string', () => {
    // @ts-expect-error - the message comes first, so an object goes second as the context
    NotFound({ orderId: 'ord-1' });
  });
});

const page: Html = Html('<p>Order ord-1</p>');
const errors = { html: (): Html => Html('<p>Error</p>') };

function handlesWithHtml(_request: OrderRequest): Promise<HandlerResponse<Html>> {
  return Promise.resolve(page);
}

suite('HTML, text and binary route response types', () => {
  const router = new HTTPRouter({ adapter: teamAdapter, errors });

  test('rejects Html on a JSON route', () => {
    // @ts-expect-error - a JSON route sends a JSON body, not Html
    router.get({ filters: { path: '/orders' }, handler: async () => page });
    // @ts-expect-error - Ok on a JSON route takes a JSON body, not Html
    router.get({ filters: { path: '/orders' }, handler: async () => Ok(page) });
  });

  test('rejects bytes on a JSON route', () => {
    // @ts-expect-error - bytes need a binary route
    router.get({ filters: { path: '/labels' }, handler: async () => new Uint8Array() });
    // @ts-expect-error - bytes need a binary route
    router.get({ filters: { path: '/labels' }, handler: async () => new ArrayBuffer(1) });
  });

  test('rejects a Map on a JSON route', () => {
    // @ts-expect-error - JSON.stringify sends a Map as {}, so its entries would be lost
    router.get({ filters: { path: '/orders' }, handler: async () => new Map([['ord-1', order]]) });
  });

  test('rejects a plain string on an HTML route', () => {
    // @ts-expect-error - an HTML route takes Html, so a plain string cannot reach the page unescaped
    router.get({ filters: { path: '/orders' }, responseType: 'html', handler: async () => '<p>Order</p>' });
  });

  test('rejects an object on an HTML route', () => {
    // @ts-expect-error - an HTML route takes Html
    router.get({ filters: { path: '/orders' }, responseType: 'html', handler: async () => order });
  });

  test('accepts Html and Ok with Html on an HTML route', () => {
    router.get({ filters: { path: '/orders' }, responseType: 'html', handler: async () => page });
    router.get({ filters: { path: '/orders' }, responseType: 'html', handler: async () => Ok(page) });
    router.get({ filters: { path: '/orders' }, responseType: 'html', handler: async () => Html(Promise.resolve('')) });
  });

  test('accepts a string on a text route', () => {
    router.get({ filters: { path: '/health' }, responseType: 'text', handler: async () => 'ok' });
    router.get({ filters: { path: '/health' }, responseType: 'text', handler: async () => Ok('ok') });
  });

  test('rejects an object on a text route', () => {
    // @ts-expect-error - a text route takes a string
    router.get({ filters: { path: '/health' }, responseType: 'text', handler: async () => order });
  });

  test('accepts bytes on a binary route', () => {
    router.get({ filters: { path: '/labels' }, responseType: 'binary', handler: async () => new Uint8Array() });
    router.get({
      filters: { path: '/labels' },
      responseType: { type: 'binary', contentType: 'application/pdf' },
      handler: async () => Buffer.from('%PDF'),
    });
  });

  test('rejects a string on a binary route', () => {
    // @ts-expect-error - a binary route takes bytes
    router.get({ filters: { path: '/labels' }, responseType: 'binary', handler: async () => 'label' });
  });

  test('rejects a responseSchema whose output is not Html on an HTML route', () => {
    const responseSchema = createMockSchema<string>();

    // @ts-expect-error - an HTML route's responseSchema must output Html
    router.get({ filters: { path: '/orders' }, responseType: 'html', responseSchema, handler: async () => page });
  });

  test('accepts a string responseSchema on a text route', () => {
    const responseSchema = createMockSchema<string>();

    router.get({ filters: { path: '/health' }, responseType: 'text', responseSchema, handler: async () => 'ok' });
    defineRoute({ filters: { method: 'GET', path: '/health' }, responseType: 'text', responseSchema }).handle(
      async () => 'ok',
    );
  });

  test("types the handler from the router's default responseType", () => {
    const htmlRouter = new HTTPRouter({ adapter: teamAdapter, responseType: 'html', errors });

    htmlRouter.get({ filters: { path: '/orders' }, handler: async () => page });
    htmlRouter.defineRoute({ filters: { method: 'GET', path: '/orders' } }).handle(async () => page);
    // @ts-expect-error - the router's default kind is html, so the handler must return Html
    htmlRouter.get({ filters: { path: '/orders' }, handler: async () => order });
    // @ts-expect-error - the router's default kind is html, so the handler must return Html
    htmlRouter.defineRoute({ filters: { method: 'GET', path: '/orders' } }).handle(async () => order);
  });

  test("uses the route's responseType over the router's", () => {
    const htmlRouter = new HTTPRouter({ adapter: teamAdapter, responseType: 'html', errors });

    htmlRouter.get({ filters: { path: '/api/orders' }, responseType: 'json', handler: async () => order });
  });

  test('types a standalone route as JSON when it sets no responseType', () => {
    const htmlRouter = new HTTPRouter({ adapter: teamAdapter, responseType: 'html', errors });

    const ordersApi = createDefineRoute<TeamAuth>()({ filters: { method: 'GET', path: '/api/orders' } });

    htmlRouter.route(ordersApi.handle(async () => order));
  });
});

suite('annotated handler response types', () => {
  const router = new HTTPRouter({ adapter: teamAdapter, errors });

  test('rejects a JSON handler on an HTML route', () => {
    // @ts-expect-error - the handler answers with a JSON body, not Html
    router.get({ filters: { path: '/orders' }, responseType: 'html', handler: handlesWithDefaultResponse });
  });

  test('rejects an Html handler on a JSON route', () => {
    // @ts-expect-error - the handler answers with Html, not a JSON body
    router.get({ filters: { path: '/orders' }, handler: handlesWithHtml });
  });

  test('accepts an Html handler on an HTML route', () => {
    router.get({ filters: { path: '/orders' }, responseType: 'html', handler: handlesWithHtml });
  });
});

suite('route object response types', () => {
  type OrdersApi = RouteDefinition<
    '/api/orders',
    PathParams<'/api/orders'>,
    Record<string, string | undefined>,
    TeamAuth
  >;

  const htmlRouter = new HTTPRouter({ adapter: teamAdapter, responseType: 'html', errors });

  test('rejects a typed route object with no responseType', () => {
    // @ts-expect-error - a typed route object names its kind, so its types and its runtime kind agree
    const ordersApi: OrdersApi = {
      filters: { method: 'GET', path: '/api/orders' },
      handler: async () => order,
    };

    htmlRouter.route(ordersApi);
  });

  test("accepts a typed route object whose responseType differs from the router's", () => {
    const ordersApi: OrdersApi = {
      filters: { method: 'GET', path: '/api/orders' },
      responseType: 'json',
      handler: async () => order,
    };

    htmlRouter.route(ordersApi);
  });

  test("types a route object passed straight to route() from the router's responseType", () => {
    htmlRouter.route({ filters: { method: 'GET', path: '/orders' }, handler: async () => page });
    // @ts-expect-error - the router's default kind is html, so the handler must return Html
    htmlRouter.route({ filters: { method: 'GET', path: '/orders' }, handler: async () => order });
  });
});

suite('responseType kinds', () => {
  const router = new HTTPRouter({ adapter: teamAdapter, errors });

  test('rejects an undefined responseType', () => {
    // @ts-expect-error - an undefined responseType leaves the kind open, so the handler could return any body
    router.get({ filters: { path: '/orders' }, responseType: undefined, handler: async () => page });
    // @ts-expect-error - an undefined responseType leaves the kind open, so the handler could return any body
    defineRoute({ filters: { method: 'GET', path: '/orders' }, responseType: undefined }).handle(async () => page);
  });

  test('rejects a responseType that could be more than one kind', () => {
    const kind = Math.random() > 0.5 ? 'json' : 'html';

    // @ts-expect-error - a route sends one kind, so its responseType must name one
    router.get({ filters: { path: '/orders' }, responseType: kind, handler: async () => page });
  });
});

suite('responseType content types', () => {
  const router = new HTTPRouter(teamAdapter);

  test('accepts a JSON content type on a JSON route', () => {
    router.get({
      filters: { path: '/orders' },
      responseType: { type: 'json', contentType: 'application/problem+json' },
      handler: async () => order,
    });
  });

  test('rejects a content type that is not JSON on a JSON route', () => {
    router.get({
      filters: { path: '/orders' },
      // @ts-expect-error - a JSON route sends JSON, so its content type must say so
      responseType: { type: 'json', contentType: 'text/csv' },
      handler: async () => order,
    });
  });

  test('accepts any content type that is not JSON on a text route', () => {
    router.get({
      filters: { path: '/returns.csv' },
      responseType: { type: 'text', contentType: 'text/csv' },
      handler: async () => 'sku,quantity',
    });
    router.get({
      filters: { path: '/page' },
      responseType: { type: 'text', contentType: 'text/html' },
      handler: async () => '<p>Order</p>',
    });
  });

  test('rejects a JSON content type on a text route', () => {
    router.get({
      filters: { path: '/health' },
      // @ts-expect-error - a JSON content type needs a JSON route
      responseType: { type: 'text', contentType: 'Application/JSON' },
      handler: async () => 'ok',
    });
  });

  test('accepts a content type that is not a literal', () => {
    const contentType: string = 'text/csv';

    router.get({
      filters: { path: '/orders' },
      responseType: { type: 'json', contentType },
      handler: async () => order,
    });
  });

  test('checks a router responseType content type', () => {
    new HTTPRouter({ adapter: teamAdapter, responseType: { type: 'text', contentType: 'text/csv' } });
    // @ts-expect-error - a JSON content type needs a JSON router
    new HTTPRouter({ adapter: teamAdapter, responseType: { type: 'text', contentType: 'application/json' } });
  });
});

suite('response content-type headers', () => {
  test('accepts a body that matches its content-type header, whatever the header-name case', () => {
    Ok('sku,quantity', { 'content-type': 'text/csv' });
    Ok('sku,quantity', { 'Content-Type': 'text/csv' });
    Ok({ title: 'Bad SKU' }, { 'CONTENT-TYPE': 'application/problem+json' });
    Ok(new Uint8Array(), { 'content-type': 'application/pdf' });
    Created(order, { location: '/orders/ord-1' });
  });

  test('rejects an object with a content-type header that is not JSON', () => {
    // @ts-expect-error - an object cannot be sent as CSV
    Ok(order, { 'Content-Type': 'text/csv' });
    // @ts-expect-error - an object cannot be sent as CSV
    Created(order, { 'content-type': 'text/csv' });
  });

  test('rejects a string with a JSON content-type header', () => {
    // @ts-expect-error - a JSON content type needs a JSON body
    Ok('sku,quantity', { 'content-type': 'application/json' });
  });

  test('accepts any body with headers that are not literals', () => {
    const headers: Record<string, string> = { 'content-type': 'text/csv' };

    Ok(order, headers);
  });
});

suite('router errors', () => {
  test('accepts an inline errors.html whose parameters are inferred', () => {
    new HTTPRouter({
      adapter: teamAdapter,
      responseType: 'html',
      // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
      errors: { html: ({ statusCode, statusText }) => Html(`<h1>${statusCode} ${statusText}</h1>`) },
    });
  });

  test('rejects an HTML router with no errors.html', () => {
    // @ts-expect-error - no default error page could match a site, so an HTML router needs errors.html
    expect(() => new HTTPRouter({ adapter: teamAdapter, responseType: 'html' })).toThrow();
  });

  test('rejects an HTML route on a router with no errors.html', () => {
    const router = new HTTPRouter(teamAdapter);

    expect(() =>
      // @ts-expect-error - an HTML route needs errors.html on its router
      router.get({ filters: { path: '/orders' }, responseType: 'html', handler: async () => page }),
    ).toThrow();
  });

  test('rejects a standalone HTML route on a router with no errors.html', () => {
    const router = new HTTPRouter(teamAdapter);
    const ordersPage = createDefineRoute<TeamAuth>()({
      filters: { method: 'GET', path: '/orders' },
      responseType: 'html',
    }).handle(async () => page);

    // @ts-expect-error - an HTML route needs errors.html on its router
    expect(() => router.route(ordersPage)).toThrow();
  });

  test('rejects an errors.html that returns a plain string', () => {
    // @ts-expect-error - errors.html must return Html
    new HTTPRouter({ adapter: teamAdapter, errors: { html: () => '<p>Error</p>' } });
  });

  test('accepts an errors.json whose body has a statusCode field', () => {
    new HTTPRouter({
      adapter: teamAdapter,
      errors: { json: ({ statusCode, message }: ErrorInput) => ({ statusCode, error: message }) },
    });
  });

  test('rejects an errors.html that returns a full ApiResponse', () => {
    // @ts-expect-error - an error function returns only a body, and the router sets the status
    new HTTPRouter({ adapter: teamAdapter, errors: { html: () => Ok(page) } });
  });

  test('types the error function input', () => {
    new HTTPRouter({
      adapter: teamAdapter,
      errors: {
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        json: (error) => {
          expectTypeOf(error).toEqualTypeOf<ErrorInput>();
          expectTypeOf(error.message).toEqualTypeOf<string>();
          expectTypeOf(error.context).toEqualTypeOf<ErrorContext | undefined>();
          return { error: error.statusText };
        },
        // biome-ignore lint/nursery/useExplicitType: the inferred parameter type is what this test asserts
        text: async ({ statusText }) => statusText,
      },
    });
  });

  test('covers every kind in ResponseBody', () => {
    expectTypeOf<ResponseBody>().toEqualTypeOf<JsonBody | Html | string | Bytes>();
  });
});

suite('middleware response types', () => {
  // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters, which is what this test asserts
  const withApiKey: HTTPMiddleware = async (request, next) => {
    if (request.headers['x-api-key'] === undefined) return new HTTPException(401);
    return next(request);
  };
  // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters, which is what this test asserts
  const withTrace: HTTPMiddleware = async (request, next) => {
    const response = await next(request);
    if (!Response.isHTTPResponse(response)) return response;
    return { ...response, headers: { ...response.headers, 'x-trace-id': 'trace-1' } };
  };
  type JsonMiddleware = HTTPMiddleware<
    Record<string, string>,
    Record<string, string | undefined>,
    unknown,
    unknown,
    JsonBody
  >;
  // biome-ignore lint/nursery/useExplicitType: HTTPMiddleware types the parameters, which is what this test asserts
  const readsOrder: JsonMiddleware = async (request, next) => next(request);

  test('accepts middleware with no response type on a route of any kind and on a router', () => {
    const router = new HTTPRouter({ adapter: teamAdapter, errors, middleware: [withApiKey, withTrace] });

    router.get({ filters: { path: '/orders' }, middleware: [withApiKey, withTrace], handler: async () => order });
    router.get({
      filters: { path: '/orders' },
      responseType: 'html',
      middleware: [withApiKey, withTrace],
      handler: async () => page,
    });
  });

  test('rejects middleware with no response type that answers with its own body', () => {
    // @ts-expect-error - the middleware does not know the route's kind, so it cannot build a body for it
    const sendsText: HTTPMiddleware = async () => 'Down for maintenance';
    // @ts-expect-error - the middleware does not know the route's kind, so it cannot build a body for it
    const sendsJson: HTTPMiddleware = async () => ({ error: 'Down for maintenance' });

    expect([sendsText, sendsJson]).toHaveLength(2);
  });

  test('accepts middleware typed for JSON on a JSON route', () => {
    const router = new HTTPRouter({ adapter: teamAdapter, errors });

    router.get({ filters: { path: '/orders' }, middleware: [readsOrder], handler: async () => order });
  });

  test('rejects middleware typed for JSON on an HTML route', () => {
    const router = new HTTPRouter({ adapter: teamAdapter, errors });

    router.get({
      filters: { path: '/orders' },
      responseType: 'html',
      // @ts-expect-error - the middleware reads a JSON body, which an HTML route does not send
      middleware: [readsOrder],
      handler: async () => page,
    });
  });

  test('rejects middleware typed for JSON on a router', () => {
    // @ts-expect-error - a router can have routes of any kind, so its middleware cannot expect JSON
    new HTTPRouter({ adapter: teamAdapter, middleware: [readsOrder] });
  });
});

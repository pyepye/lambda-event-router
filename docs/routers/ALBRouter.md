# ALBRouter

`ALBRouter` routes Application Load Balancer requests to handlers, one request per invocation.

Your routes are matched on method and path, your handler returns a body, and the router turns that into
the status code and response shape a load balancer target expects. An ALB sends one event shape, so there
are no payload versions to think about.

## Install

```bash
npm install @lambda-event-router/alb
```

`@lambda-event-router/base` and `@lambda-event-router/http` both come along as dependencies, so you do
not need to install either yourself. The shared HTTP types, [`HTTPMiddleware`](#middleware) among them,
are re-exported from here.

## Create the router

```ts
import { createALBRouter } from '@lambda-event-router/alb'
import { withRequestLog } from './middleware/withRequestLog'

const albRouter = createALBRouter({
  middleware: [withRequestLog],  // Optional
  cors: { origin: 'https://app.example.com' },  // Optional
})
```

Both options can be left out. `createALBRouter()` on its own gives you a router that answers 404 for anything
you have not registered and sends no CORS headers.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `HTTPMiddleware[]` | No | `[]` | Runs for every request this router handles, before any route middleware. See [Middleware](#middleware) |
| `cors` | `CorsConfig` | No | | Answers preflight and adds CORS headers to every response. See [CORS](#cors) |

## Register routes

```ts
albRouter.route({
  filters: {
    method: 'POST',
    path: '/orgs/:orgId/orders',
  },
  querySchema: CreateOrderQuerySchema,  // Optional
  bodySchema: NewOrderSchema,  // Optional
  responseSchema: OrderSchema,  // Optional
  middleware: [withOrgContext],  // Optional
  handler: createOrder,
})
```

`filters` and `handler` are the only required keys, and inside `filters` both `method` and `path` are
required.

`route()` returns the router, so you can chain registrations.

```ts
albRouter.route(createOrderRoute).route(getOrderRoute)
```

Method and path are both part of the match, so two routes only compete when they share a method and their
paths overlap. `GET /orders/:orderId` and `POST /orders/latest` never collide.

Where they do share a method, routes match by path specificity rather than registration order: a literal
segment beats a param at the same position, compared left to right. So `GET /orders/latest` takes
`/orders/latest` while `GET /orders/:orderId` catches every other id, whichever order you register them in.
Two routes of the same shape differing only in a param name, such as `GET /orders/:orderId` and
`GET /orders/:id`, match the same paths and cannot be ranked, so registering the second throws. See
[match order](/docs/routing#match-order).

**When nothing matches, the router answers 404 with `{"error":"Not found"}` and runs no middleware.** A
path you have registered under another method counts as no match rather than a 405, so `DELETE /orders/1`
against a `GET /orders/:orderId` route answers 404. See [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

The listener rules in front of your Lambda decide what reaches the target group at all, so a 404 from here
means the request got through those and then matched no route you registered.

**`route()` types `body` as `never` until you attach a `bodySchema`,** whatever method the filters name, so
an inline handler on a `POST` cannot read it. Attach the schema you were going to write anyway, or reach
for `post()`, `put()` or `patch()`, which give you `unknown` without one.

### Convenience methods

`get()`, `post()`, `put()`, `patch()`, `delete()`, `head()` and `options()` fill in the `method` filter and
take everything else exactly as `route()` does.

```ts
// Both of these register the same route
albRouter.get({
  filters: { path: '/orders/:orderId' },
  handler: getOrder,
})

albRouter.route({
  filters: { method: 'GET', path: '/orders/:orderId' },
  handler: getOrder,
})
```

| Method | Sets | Takes a `bodySchema` | Types `body` as |
| --- | --- | --- | --- |
| `get()` | `method: 'GET'` | No | `undefined` |
| `post()` | `method: 'POST'` | Yes | The schema output, or `unknown` |
| `put()` | `method: 'PUT'` | Yes | The schema output, or `unknown` |
| `patch()` | `method: 'PATCH'` | Yes | The schema output, or `unknown` |
| `delete()` | `method: 'DELETE'` | No | `undefined` |
| `head()` | `method: 'HEAD'` | No | `undefined` |
| `options()` | `method: 'OPTIONS'` | No | `undefined` |

Each method rejects a `method` in its filters, and the four with no body reject a `bodySchema` outright.
`route()` still takes everything. See [convenience methods](/docs/routing#convenience-methods) for how the
other routers use them.

Typing `body` as `undefined` on those four is the types keeping you honest rather than the router dropping
anything. A `GET` or `DELETE` that arrives with a body still has it parsed, so `request.event.body` holds
it if you are talking to a client that sends one.

An `options()` route wins over the automatic [CORS](#cors) preflight, which is how you take over answering a
preflight for one path.

**A `HEAD` response never sends a body.** HTTP says a `HEAD` response carries no content, so the router drops
the body and keeps the status code and headers. Return a value or `NoContent()`, either way the body is stripped.

## Filters

Every filter key on one route. `method` and `path` are required, and `custom` is the only optional
one.

```ts
albRouter.route({
  filters: {
    method: 'POST', // Or lower case, so 'post' works too
    path: '/orgs/:orgId/orders',
    custom: ({ headers }) => {
      // Only a custom reaches the headers or the raw event
      return headers['x-amzn-oidc-identity'] !== undefined
    },
  },
  handler: createOrder,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `method` | `AnyHttpMethod` | The request method. Lower case is uppercased for you, so `'get'` and `'GET'` register the same route |
| `path` | `string` | A path pattern, with `:name` marking each param. Not a `FilterStringMatcher` |
| `custom` | `(input: HTTPFilterInput) => boolean \| Promise<boolean>` | Given `{ method, path, headers, multiValueHeaders, query, multiValueQuery, body, auth, event }`, where `path` is the raw path string and `body` is the request body before parsing. Can be async |

`method` and `path` are the whole of the built in matching, which is why headers are worth a `custom`
here where they would be a filter key on another router.

**`custom` sees the body as an unparsed string and no schema has run**, so parse it yourself if you
need it, and prefer the [request object](#request-object) for anything you only want once a route has
matched. See [`custom`](/docs/routing#custom) for where it sits in the filter order.

**On a convenience method, `custom` is typed `(input: unknown)`.** Annotating the parameter does not
compile either, so use `route()` or [`defineRoute`](#inferred-handlers) for any route whose filter needs to
read its input.

### Path patterns

A `:name` segment matches one segment and gives your handler that value under `name`. `PathParams` reads
the same syntax to type `request.path`, so naming the params is what types them.

| Pattern | Request | `request.path` |
| --- | --- | --- |
| `/orders/:orderId` | `/orders/9` | `{ orderId: '9' }` |
| `/orgs/:orgId/orders/:orderId` | `/orgs/acme/orders/9` | `{ orgId: 'acme', orderId: '9' }` |
| `/orders/:orderId` | `/orders/9/items` | No match, a param stops at the next `/` |
| `/orders` | `/orders/` | `{}`, a trailing slash comes off both sides |
| `/orders/{orderId}` | `/orders/9` | No match |
| `/orders/{orderId}` | `/orders/{orderId}` | `{}` |
| `/files/:name.json` | `/files/report.json` | `{ 'name.json': 'report.json' }` |
| `/v1.0/orders` | `/v1X0/orders` | No match, the `.` is a literal dot |

The two `{name}` rows and `/files/:name.json` are traps rather than features.

**`{name}` is not path param syntax here.** It is a literal, which types nothing and matches only a request
for that exact string. Use `:orderId`.

**A param runs to the end of its segment,** so it cannot have a suffix. `/files/:name.json` names the param
`name.json` and hands you the whole segment, rather than matching a `.json` extension.

**A `.`, `+` or other regex metacharacter in a literal segment matches itself.** The literal parts of a
pattern are escaped before it is compiled to a regular expression, so `/v1.0/orders` matches `/v1.0/orders`
and nothing else.

**A param followed by a literal segment types nothing.** `PathParams` only reads a pattern whose last
segment is a param, so `/orgs/:orgId/orders/:orderId` gives you `{ orgId: string; orderId: string }` while
`/orgs/:orgId/orders` collapses to `Record<string, string>`. Matching is unaffected and `path.orgId` still
holds the right value at runtime. The types just stop knowing about it, and an inferred handler reads it as
`string | undefined`.

That is the shape of most collection routes, so it comes up on the `POST` half of a resource more often
than the `GET`. Either narrow it in the handler, or annotate the request and skip inference for that route.

```ts
// Inferred, so narrow what you are given
defineRoute({ filters: { method: 'POST', path: '/orgs/:orgId/orders' } }).handle(async ({ path }) => {
  const { orgId } = path
  if (!orgId) throw BadRequest({ error: 'Missing orgId' })

  return Created(await orders.create(orgId))
})
```

```ts
// Annotated, so say what the path holds
async function createOrder(request: ApiRequest<{ orgId: string }>): Promise<HandlerResponse<Order>> {
  return Created(await orders.create(request.path.orgId))
}
```

## Handler

Handlers take one argument and return the body they want on the wire.

```ts
import type { ApiRequest, HandlerResponse } from '@lambda-event-router/alb'
import { NotFound, Ok } from '@lambda-event-router/alb'

export async function getOrder(
  request: ApiRequest<{ orderId: string }>,
): Promise<HandlerResponse<Order>> {
  const order = await orders.get(request.path.orderId)
  if (!order) {
    throw NotFound({ error: `Order ${request.path.orderId} not found` })
  }

  return Ok(order)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `method` | `string` | The request method, upper case |
| `path` | `TPath` | The params named in the route's path pattern. Empty when the pattern names none |
| `rawPath` | `string` | The path string the caller asked for |
| `query` | `TQuery` | Query string params, one value per key. Where a name repeats, this is the last value |
| `multiValueQuery` | `Record<string, string[] \| undefined>` | Every value for each query param, in the order they arrived |
| `body` | `TBody` | The parsed JSON body. A body that is not valid JSON arrives as the raw string, and no body at all as `null` |
| `headers` | `Record<string, string \| undefined>` | Request headers, lower cased by the router. Where a name repeats, this is the last value |
| `multiValueHeaders` | `Record<string, string[] \| undefined>` | Every value for each header, lower cased key |
| `auth` | `Auth` | Always set, and only ever carries `targetGroupArn`. See [Auth](#auth) |
| `event` | `TEvent` | The untouched `ALBEvent`, for `requestContext` and anything else you need |
| `context` | `Context` | The Lambda context |

`ALBEvent` and `Context` both come from `aws-lambda` rather than from this package, so import them from
there when you name them.

`path` holds the params rather than the path itself. Read `request.rawPath` when you want the string the
caller asked for.

A base64 encoded body is decoded before it is parsed, so `isBase64Encoded` is handled for you.

Multi-value headers is a target group attribute. With it on the ALB sends `multiValueHeaders` and
`multiValueQueryStringParameters` in place of the single-value pair. The router reads both forms, so
`request.query` and `request.headers` come through the same either way. Where a name repeats, the flat
`query` and `headers` keep the last value and the full list lives on `request.multiValueQuery` and
`request.multiValueHeaders`.

If you have a param that can appear more than once, like `?tag=a&tag=b`, read `request.multiValueQuery.tag`
to get `['a', 'b']`. `request.query.tag` gives you `'b'`.

### Response type

`HandlerResponse<T>` is `ApiResponse<T> | T`, so you can return the body on its own or a full
`{ statusCode, body, headers }`. See [Responses](#responses) for what the router does with each.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineRoute` reads the path pattern and the schemas and
hands your handler a typed `path`, `query` and `body`, so `orgId` and `orderId` below are both `string` and
`body` matches `NewOrderSchema` without you declaring either.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute, Ok } from '@lambda-event-router/alb'
import { z } from 'zod'

const NewOrderSchema = z.object({ sku: z.string(), quantity: z.number() })

export const replaceOrderRoute = defineRoute({
  filters: { method: 'PUT', path: '/orgs/:orgId/orders/:orderId' },
  bodySchema: NewOrderSchema,
}).handle(async ({ path, body }) => {
  const order = await orders.replace(path.orgId, path.orderId, body.sku, body.quantity)
  logger.info(`Replaced order ${path.orderId} for org ${path.orgId}`)

  return Ok(order)
})

albRouter.route(replaceOrderRoute)
```

`route()` and the convenience methods infer the same types from the same schemas, so the choice between the
two forms is about where your code sits rather than what it is typed as.

Inference is only as good as the path pattern, so read [path patterns](#path-patterns) before relying on
`path` being typed.

Inference pays off most in a Lambda taking several event sources, since you never have to know any of their
request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue is written
both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`ApiRequest`](#generic-parameters) and your own types.

```ts
// handlers/orders.ts
import type { ApiRequest, HandlerResponse } from '@lambda-event-router/alb'
import { Created } from '@lambda-event-router/alb'
import { z } from 'zod'

export const NewOrderSchema = z.object({ sku: z.string(), quantity: z.number() })
type NewOrder = z.infer<typeof NewOrderSchema>

export async function createOrder(
  request: ApiRequest<{ orgId: string }, Record<string, string | undefined>, NewOrder>,
): Promise<HandlerResponse<Order>> {
  const { orgId } = request.path
  const { sku, quantity } = request.body

  return Created(await orders.create(orgId, sku, quantity))
}
```

```ts
// alb.ts
import { createALBRouter } from '@lambda-event-router/alb'

import { createOrder, NewOrderSchema } from './handlers/orders'

const albRouter = createALBRouter()

albRouter.post({
  filters: { path: '/orgs/:orgId/orders' },
  bodySchema: NewOrderSchema,
  handler: createOrder,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
[Annotated handlers](/docs/handlers#annotated-handlers) has the worked version.

For the path you can do the same with `PathParams<'/orgs/:orgId/orders/:orderId'>`, which reads the params
out of the pattern so you are not keeping a second copy of it in step. Check it against [path
patterns](#path-patterns) first, since a pattern ending in a literal segment gives you nothing and writing
the type out by hand is the answer there.

`ApiRequest` takes its parameters in the order `TPath`, `TQuery`, `TBody`, so typing only the body means
passing the query type through as well. [Generic parameters](#generic-parameters) has each one, its default
and which types take them in a different order.

## Schema validation

Three keys take a schema, and all three are optional.

```ts
const OrderQuerySchema = z.object({ expand: z.string().optional() })
const NewOrderSchema = z.object({ sku: z.string(), quantity: z.number() })
const OrderSchema = z.object({ orderId: z.string(), sku: z.string(), quantity: z.number() })

albRouter.route({
  filters: { method: 'POST', path: '/orgs/:orgId/orders' },
  querySchema: OrderQuerySchema,
  bodySchema: NewOrderSchema,
  responseSchema: OrderSchema,
  handler: createOrder,
})
```

| Key | Validates | A failure answers |
| --- | --- | --- |
| `querySchema` | The query string params | 400, with the validation issues as the body |
| `bodySchema` | The parsed request body | 422, with the validation issues as the body |
| `responseSchema` | The value the handler returns, unless it returns an explicit HTTP response | 500 |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has matched,
so a request failing its schema gets an error response rather than falling through to the next route, and no
middleware runs. The query is checked first, so a request with a bad query and a bad body gets the 400.

Both failures put the issues array straight in the body, so the caller sees the schema library's own
messages and paths.

```json
[{ "code": "invalid_type", "path": ["quantity"], "message": "Invalid input: expected number, received string" }]
```

The handler receives the schema output. A `querySchema` of `z.object({ page: z.coerce.number().default(1) })`
hands `query.page` the number `2` for `?page=2` and `1` when the param is absent, and unknown keys are
stripped. A value the handler returns that fails its `responseSchema` answers 500; an explicit HTTP response
is sent unchanged, without that check.

## Responses

Return a value and the router works out the status code, serialises the body and sets a JSON content type
where one applies.

```ts
return { orderId: order.orderId }             // 200, with a JSON content type
return Ok({ orderId: order.orderId })         // The same 200
return { statusCode: 200, body: order }       // Also the same 200
```

| You return | You get |
| --- | --- |
| An object | 200, with a JSON content type |
| An array | 200, with a JSON content type |
| A string, a number or `false` | 200 |
| `undefined`, `null`, `''`, `true` or `{}` | 204 |

### Response helpers

Anything other than a 200 or a 204 goes through a helper, or you set the status code yourself. Every helper
takes the response body rather than a message, and the ones with a default body can be called with no
arguments.

| Helper | Status | Default body |
| --- | --- | --- |
| `Ok(body, headers?)` | 200 | Body is required |
| `Created(body, headers?)` | 201 | Body is required |
| `NoContent()` | 204 | Empty |
| `TemporaryRedirect(location)` | 307 | Empty, with a `Location` header |
| `PermanentRedirect(location)` | 308 | Empty, with a `Location` header |
| `BadRequest(body?, headers?)` | 400 | `{ error: 'Bad request' }` |
| `Unauthorised(body?, headers?)` | 401 | `{ error: 'Unauthorised' }` |
| `Forbidden(body?, headers?)` | 403 | `{ error: 'Forbidden' }` |
| `NotFound(body?, headers?)` | 404 | `{ error: 'Not found' }` |
| `Conflict(body?, headers?)` | 409 | `{ error: 'Conflict' }` |
| `UnprocessableContent(body?, headers?)` | 422 | `{ error: 'Unprocessable content' }` |
| `InternalServerError(body?, headers?)` | 500 | `{ error: 'Internal server error' }` |

For a code with no helper, hand back an `ApiResponse` yourself. `HTTP_STATUS_CODES` is exported if you would
rather not write the number.

```ts
import { HTTP_STATUS_CODES } from '@lambda-event-router/alb'

return { statusCode: HTTP_STATUS_CODES.SERVICE_UNAVAILABLE, body: { error: 'Down for maintenance' } }
```

### Throwing

Throwing a helper works the same as returning it, and it carries the same weight from any depth, so a
function three calls below your handler can end the request without every function in between passing a
failure back up.

```ts
import { Conflict, NotFound } from '@lambda-event-router/alb'

const order = await orders.get(path.orderId)
if (!order) throw NotFound({ error: `Order ${path.orderId} not found` })
if (order.status === 'SHIPPED') throw Conflict({ error: 'Shipped orders cannot be cancelled' })
```

**Anything else thrown becomes a 500 with the error message as the body,** so keep internal detail out of
the errors your handlers can throw. A `new Error('connect ETIMEDOUT 10.0.1.5:8000')` puts that address on
the wire. The router logs it before answering.

A 502 reaching the client is the load balancer rather than anything on this page. An ALB answers 502 of its
own accord when a Lambda returns a shape it cannot read, or when the function errors outside the router.

See [HTTP responses](/docs/handlers#http-responses) for the shapes shared with the other HTTP routers.

## Auth

`request.auth` is always set on this router and only ever carries one field.

| Field | Type | Description |
| --- | --- | --- |
| `targetGroupArn` | `string` | The ARN of the target group the request came through |

`Auth` is shared across the HTTP routers, so it declares `claims`, `principalId` and the rest as optional.
None of them are ever populated here, because an ALB gives the router nothing to read them from.

Where an ALB does authenticate, with an `authenticate-oidc` or `authenticate-cognito` listener rule, it puts
the result in request headers instead. Read those off `request.headers`, lower cased.

| Header | Holds |
| --- | --- |
| `x-amzn-oidc-identity` | The `sub` claim from the user info endpoint, in plain text |
| `x-amzn-oidc-accesstoken` | The access token from the token endpoint, in plain text |
| `x-amzn-oidc-data` | The user claims as a JWT, signed by the load balancer with ES256 |

**Verify `x-amzn-oidc-data` before you authorise anything on it.** AWS requires two checks: the signature
against the regional public key at `https://public-keys.auth.elb.<region>.amazonaws.com/<key-id>`, and that
the `signer` field in the JWT header is your load balancer's ARN. Nothing in this router does either. AWS
publishes [aws-jwt-verify](https://github.com/awslabs/aws-jwt-verify) for the first part, and
[authenticate users](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-authenticate-users.html)
covers the flow.

A [middleware](#middleware) is the place to put that check once for a group of routes.

## CORS

An ALB has no CORS feature of its own, unlike an API Gateway, so the Lambda is the only place this can
happen.

`createALBRouter` takes a `cors` option, and turning it on covers preflight and every response the router
sends.

```ts
const albRouter = createALBRouter({
  cors: {
    origin: 'https://app.example.com',
    credentials: true,  // Optional
    maxAge: 600,  // Optional
    methods: ['GET', 'POST'],  // Optional
    allowedHeaders: ['content-type', 'x-api-key'],  // Optional
    exposedHeaders: ['x-request-id'],  // Optional
  },
})
```

`origin` is the only required key.

**OPTIONS is answered for you,** with a 204 and an `Access-Control-Allow-Methods` built from the methods you
actually registered for that path. A path with a `GET` and a `POST` answers `GET, POST, OPTIONS`, and there is
no list to keep in step as you add routes.

The headers go on every response the router sends, including a 404, a 400 from a `querySchema`, a 422 from a
`bodySchema` and anything your handler throws. A middleware could not do that, because it only wraps the
handler.

### CORS options

| Key | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `origin` | `string \| string[] \| CorsOriginFunction` | Yes | | A single origin, a list to match the request's origin against, or a function returning the origin to allow |
| `methods` | `HttpMethod[]` | No | The methods registered for the path, plus `OPTIONS` | Overrides `Access-Control-Allow-Methods` on a preflight |
| `allowedHeaders` | `string[]` | No | Whatever the request asked for in `Access-Control-Request-Headers` | `Access-Control-Allow-Headers` on a preflight |
| `exposedHeaders` | `string[]` | No | | `Access-Control-Expose-Headers` on a non-preflight response |
| `credentials` | `boolean` | No | `false` | Sets `Access-Control-Allow-Credentials` |
| `maxAge` | `number` | No | | `Access-Control-Max-Age` in seconds, on a preflight |

`CorsOriginFunction` is `(origin: string, path: string) => string | undefined | Promise<string | undefined>`.
Return the origin to allow it and `undefined` to refuse, which is how you check a tenant's origin against a
database. It is only called when the request carries an `Origin` header.

`Vary: Origin` is set for any origin that is not `*`, so a shared cache cannot serve a no-CORS response to an
allowed origin. A list or a function that refuses the request still gets `Vary: Origin` on a non-preflight
response for the same reason.

**Setting `credentials` with `origin: '*'` throws when the router is created.** Browsers reject that
combination, so the constructor refuses it rather than letting you deploy it. In a Lambda that surfaces as an
init failure rather than a failing request.

### Handling preflight yourself

An `OPTIONS` route wins over the automatic preflight, so you can take over one path and leave the rest alone.

```ts
albRouter.options({
  filters: { path: '/orders' },
  handler: async () => ({
    statusCode: 204,
    body: undefined,
    headers: { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' },
  }),
})
```

The CORS headers are still added to whatever your handler returns. If the route has a `custom` that
rejects the request, the automatic preflight picks it up instead.

## Middleware

Router and route middleware are both typed `HTTPMiddleware`, and the chain runs once per request.

```ts
import { logger } from '@lambda-event-router/base'
import { Unauthorised } from '@lambda-event-router/alb'
import type { HTTPMiddleware } from '@lambda-event-router/alb'

export const withOidcIdentity: HTTPMiddleware = async (request, next) => {
  const identity = request.headers['x-amzn-oidc-identity']
  if (!identity) {
    logger.warn(`Rejected a ${request.method} with no OIDC identity header`)
    throw Unauthorised()
  }

  logger.appendKeys({ identity })

  return next(request)
}
```

```ts
const albRouter = createALBRouter({ middleware: [withOidcIdentity] })

albRouter.put({
  filters: { path: '/orgs/:orgId/orders/:orderId' },
  bodySchema: NewOrderSchema,
  middleware: [withOrgContext],
  handler: replaceOrder,
})
```

A middleware can also short-circuit by returning a response instead of calling `next`, so an auth check or a
maintenance window can answer without the handler running. Checking the header is present is not the same as
verifying the signed claims, so read [Auth](#auth) before treating it as authentication.

The bare alias is the right one for router middleware, which runs for every route and so cannot know any one
route's shape. That is where a check like the one above belongs.

**On a route, the bare alias pins the route's types and the handler quietly loses them.** `HTTPMiddleware`
with no parameters defaults `path` to `Record<string, string>`, `query` to the raw query and `body` to
`unknown`, and attaching it overrides whatever the path pattern and the schemas would have given the
handler. A route with `path: '/orgs/:orgId/orders'` and a `bodySchema` still compiles with a bare alias
attached, and its handler gets neither `path.orgId` nor the schema's body.

Spell the parameters out to match the route, in the order [`TPath`, `TQuery`,
`TBody`](#generic-parameters).

```ts
export const withOrgContext: HTTPMiddleware<
  { orgId: string; orderId: string },
  Record<string, string | undefined>,
  NewOrder
> = async (request, next) => {
  logger.appendKeys({ orgId: request.path.orgId, orderId: request.path.orderId })

  return next(request)
}
```

Every parameter you leave off falls back to the alias default, so a middleware for the route above has to
name both path params or the handler loses the one it skipped.

Two cases fail the compile rather than going quiet. A `querySchema` on a route with a bare alias attached
stops assigning, and the four methods with no body reject the bare alias outright because they type `body` as
`undefined`.

Neither level runs when nothing matched or when a schema failed. See [middleware](/docs/middleware) for the
execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/alb`.

| Type | Description |
| --- | --- |
| `ApiRequest<TPath, TQuery, TBody, TEvent>` | The handler argument |
| `HandlerResponse<TResponse>` | Handler return type, `ApiResponse<TResponse> \| TResponse` |
| `ApiResponse<T>` | `{ statusCode, body, headers? }` |
| `HTTPResponse<T>` | An alias of `ApiResponse<T>`, and what the helpers return |
| `ApiHandler<TPath, TQuery, TBody, TResponse>` | The handler signature |
| `RouteDefinition<TPathString, TPath, TQuery, TBody, TResponse>` | A full route passed to `route()` |
| `PathParams<TPathString>` | The params a pattern names, so `PathParams<'/orders/:orderId'>` is `{ orderId: string }` |
| `Auth` | `request.auth` |
| `CorsConfig` | The `cors` option |
| `CorsOriginFunction` | A dynamic `origin`, `(origin, path) => string \| undefined` |
| `ALBRouterOptions` | Options for `createALBRouter` |
| `AnyHttpMethod` | What the `method` filter accepts, upper or lower case |
| `HttpMethod` | The upper case methods |

`ALBEvent` and `ALBResult` are not re-exported, so `request.event` is typed by `aws-lambda` and you import
those two from there.

`HTTPFilters`, `HTTPFilterInput` and `HTTPMiddleware` originate in `@lambda-event-router/http` and are
re-exported from here, so import them from here rather than naming that package. The route definition
and request types carry no `ALB` prefix because `APIGatewayRouter` and `VPCLatticeRouter` use the same
ones.

The `ALBRouter` class and the `createALBRouter` and `defineRoute` functions come from the same place, along
with the `Response` class, the response helpers, `HTTP_STATUS_CODES` and `albAdapter`.

`HTTPRouter`, `NormalizedHTTPEvent`, `FinalizedHTTPResponse` and `HTTPAdapter` are exported for writing
an adapter of your own and pairing it with a router, and are not something a route needs. An ALB sends
one event shape, so unlike API Gateway and Lattice there is no payload version to pin a router to.

### Generic parameters

Six parameters cover every type above, and they do not all appear in the same order.

| Parameter | Types | Default |
| --- | --- | --- |
| `TPathString` | The path pattern itself, which `PathParams` reads | `string` |
| `TPath` | `request.path` | `PathParams<TPathString>` on `RouteDefinition`, `Record<string, string>` elsewhere |
| `TQuery` | `request.query` | `Record<string, string \| undefined>` |
| `TBody` | `request.body` | `unknown`, except on `route()` where it is `never` |
| `TResponse` | What the handler returns | `unknown` |
| `TEvent` | `request.event` | `unknown` |

`ApiRequest`, `ApiHandler` and `HTTPMiddleware` all start `TPath, TQuery, TBody`. `ApiRequest`'s fourth is
`TEvent` while the other two take `TResponse`. `RouteDefinition` puts `TPathString` first and derives `TPath`
from it.

Pass only the ones you need up to the last one you care about, so `ApiRequest<{ orderId: string }>` types the
path and leaves the query and body loose.

You only need these for [annotated handlers](#annotated-handlers). Inference covers all of them.

## Code example

An orders service behind a load balancer, with a list, a fetch and a create.

Open a file: [index.ts](#alb-example:index.ts) | [ALB router](#alb-example:alb.ts) | [middleware](#alb-example:middleware/requireOidcIdentity.ts) | [handlers](#alb-example:handlers/orders.ts) | [schemas](#alb-example:schemas/order.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { albRouter } from './alb.js'

const lambdaRouter = new LambdaRouter({
  routers: [albRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'alb.ts',
    code: `import { createALBRouter } from '@lambda-event-router/alb'

import { requireOidcIdentity } from './middleware/requireOidcIdentity.js'
import { createOrder, getOrder, listOrders } from './handlers/orders.js'
import { ListOrdersQuerySchema, NewOrderSchema, OrderSchema } from './schemas/order.js'

export const albRouter = createALBRouter({ middleware: [requireOidcIdentity] })

albRouter
  .get({
    filters: { path: '/orgs/:orgId/orders' },
    querySchema: ListOrdersQuerySchema,
    handler: listOrders,
  })
  .get({
    filters: { path: '/orgs/:orgId/orders/:orderId' },
    responseSchema: OrderSchema,
    handler: getOrder,
  })
  .post({
    filters: { path: '/orgs/:orgId/orders' },
    bodySchema: NewOrderSchema,
    responseSchema: OrderSchema,
    handler: createOrder,
  })`,
  },
  {
    path: 'middleware/requireOidcIdentity.ts',
    code: `import { Unauthorised } from '@lambda-event-router/alb'
import { logger } from '@lambda-event-router/base'
import type { HTTPMiddleware } from '@lambda-event-router/alb'

// The load balancer sets this once an authenticate-oidc rule has run
export const requireOidcIdentity: HTTPMiddleware = async (request, next) => {
  const identity = request.headers['x-amzn-oidc-identity']
  if (!identity) {
    logger.warn(\`Rejected a \${request.method} with no OIDC identity header\`)
    throw Unauthorised()
  }

  // Verify x-amzn-oidc-data before authorising on any claim it carries
  logger.appendKeys({ identity })

  return next(request)
}`,
  },
  {
    path: 'handlers/orders.ts',
    code: `import type { ApiRequest, HandlerResponse } from '@lambda-event-router/alb'
import { Created, NotFound, Ok } from '@lambda-event-router/alb'
import { logger } from '@lambda-event-router/base'

import { orders } from '../orders.js'
import type { ListOrdersQuery, NewOrder, Order } from '../schemas/order.js'

type OrgPath = { orgId: string }
type OrderPath = { orgId: string; orderId: string }

export async function listOrders(
  request: ApiRequest<OrgPath, ListOrdersQuery>,
): Promise<HandlerResponse<Order[]>> {
  const { orgId } = request.path
  // The schema marks status optional with no default, so the handler picks one when it is absent
  const status = request.query.status ?? 'OPEN'

  return Ok(await orders.list(orgId, status))
}

export async function getOrder(request: ApiRequest<OrderPath>): Promise<HandlerResponse<Order>> {
  const { orgId, orderId } = request.path

  const order = await orders.get(orgId, orderId)
  if (!order) {
    throw NotFound({ error: \`Order \${orderId} not found\` })
  }

  return Ok(order)
}

export async function createOrder(
  request: ApiRequest<OrgPath, Record<string, string | undefined>, NewOrder>,
): Promise<HandlerResponse<Order>> {
  const { orgId } = request.path
  const { sku, quantity } = request.body

  const order = await orders.create(orgId, sku, quantity)
  logger.info(\`Created order \${order.orderId} for org \${orgId}\`)

  return Created(order)
}`,
  },
  {
    path: 'schemas/order.ts',
    code: `import { z } from 'zod'

export const OrderStatusSchema = z.union([z.literal('OPEN'), z.literal('SHIPPED')])

export const OrderSchema = z.object({
  orderId: z.string(),
  sku: z.string(),
  quantity: z.number(),
  status: OrderStatusSchema,
})

export const NewOrderSchema = OrderSchema.pick({ sku: true, quantity: true })

export const ListOrdersQuerySchema = z.object({
  status: OrderStatusSchema.optional(),
})

export type Order = z.infer<typeof OrderSchema>
export type NewOrder = z.infer<typeof NewOrderSchema>
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="alb-example" default-file="alb.ts" line-numbers collapse-toggle fixed-height />

`/orgs/:orgId/orders` and `/orgs/:orgId/orders/:orderId` are different path patterns, and the list and the
create differ by method, so no request matches two routes and the order you register them in makes no
difference.

`requireOidcIdentity` is router middleware, so it runs for all three routes and uses the bare
`HTTPMiddleware` alias. A route level middleware would have to name that route's path params and body type
instead.

The schemas live in one file and are attached to the routes in `alb.ts` rather than next to the handlers,
which keeps the handlers free of anything about how the request arrived. `listOrders` fills in its own
default for `status` because [its schema marks the param optional with no default](#schema-validation).

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the Lambda
gets registered on. See [routers](/docs/routers) for how the two levels of matching fit together.

# ALBRouter

`ALBRouter` routes Application Load Balancer requests to handlers, one request per invocation.

Your routes are matched on method and path, your handler returns a body, and the router turns that into
the status code and response shape a load balancer target expects. An ALB sends one event shape, so there
are no payload versions to think about.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/alb
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

`@lambda-event-router/http` comes along as a dependency. The shared HTTP types,
[`HTTPMiddleware`](#middleware) among them, are re-exported from here.

## Create the router

```ts
import { createALBRouter } from '@lambda-event-router/alb'
import { withRequestLog } from './middleware/withRequestLog'

const albRouter = createALBRouter({
  responseType: 'json',  // Optional
  errors: {  // Optional
    json: ({ statusCode, message }) => ({ status: statusCode, message }),
  },
  middleware: [withRequestLog],  // Optional
  cors: { origin: 'https://app.example.com' },  // Optional
})
```

Every option can be left out. `createALBRouter()` on its own gives you a router that answers
JSON, answers 404 for anything you have not registered and sends no CORS headers.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `responseType` | `ResponseTypeOption` | No | `'json'` | What every route answers with unless it names its own. See [response types](#response-types) |
| `errors` | `ErrorFunctions` | No | | Builds the body of every error response, one function per kind. Required when the router serves HTML. See [error responses](#error-responses) |
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
  middleware: [withOrgContext],  // Optional
  responseType: 'json',  // Optional
  responseSchema: OrderSchema,  // Optional
  handler: createOrder,
})
```

`filters` and `handler` are the only required keys, and inside `filters` both `method` and `path` are
required. A `responseType` on the route overrides the router's, so one router can mix
[response types](#response-types).

`route()` returns the router, so you can chain registrations.

```ts
albRouter.route(createOrderRoute).route(getOrderRoute)
```

Method and path are both part of the match, so two routes only compete when they share a method and their
paths overlap. `GET /orders/:orderId` and `POST /orders/latest` never collide.

Where they do share a method, routes match by path specificity rather than registration order: a literal
segment beats a param at the same position, compared left to right. So `GET /orders/latest` takes
`/orders/latest` while `GET /orders/:orderId` catches every other id, whichever order you register them in.
A segment that mixes literal text with a param sits between the two, so `/files/:name.json` beats
`/files/:id` for `/files/report.json`.
Two routes of the same shape differing only in a param name, such as `GET /orders/:orderId` and `GET
/orders/:id`, match the same paths and cannot be ranked, so the one you registered first wins and the
second never runs. Giving one of them a `custom` ranks it first, because a `custom` can only reject a
request and never accept an extra one. See [match order](/docs/routing#match-order).

**When nothing matches, the router answers 404 and runs no middleware.** A JSON router sends
`{"error":"Not found"}`, and any other router sends its own [error response](#error-responses). A
path you have registered under another method counts as no match rather than a 405, so `DELETE /orders/1`
against a `GET /orders/:orderId` route answers 404. See [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

The listener rules in front of your Lambda decide what reaches the target group at all, so a 404 from here
means the request got through those and then matched no route you registered.

**`route()` types `body` from the `method` filter.** A `POST`, `PUT` or `PATCH` route gets `unknown` and
the other four get `undefined`, the same as the [convenience methods](#convenience-methods). A `bodySchema`
replaces either with the schema output.

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

| Method | Sets | Types `body` as without a `bodySchema` |
| --- | --- | --- |
| `get()` | `method: 'GET'` | `undefined` |
| `post()` | `method: 'POST'` | `unknown` |
| `put()` | `method: 'PUT'` | `unknown` |
| `patch()` | `method: 'PATCH'` | `unknown` |
| `delete()` | `method: 'DELETE'` | `undefined` |
| `head()` | `method: 'HEAD'` | `undefined` |
| `options()` | `method: 'OPTIONS'` | `undefined` |

Every method takes a `bodySchema`, and `body` is then the schema output. Each method rejects a `method` in
its filters. See [convenience methods](/docs/routing#convenience-methods) for how the other routers use them.

**A `GET`, `HEAD`, `DELETE` or `OPTIONS` route without a `bodySchema` never parses the body**, so the handler
gets `undefined` even when the client sends one. Add a `bodySchema` if the route needs it. See [request
body](#request-body) for when the router parses it.

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
  bodySchema: NewOrderSchema,
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

### Path patterns

A `:name` param matches text inside one segment and gives your handler that value under `name`. The name
uses ASCII letters, digits, `_` and `$`, and can't start with a digit. It ends at the first character
outside that set, so `/files/:name.json` has a param called `name` followed by the literal text `.json`.

`PathParams` reads the same syntax to type `request.path`. For `/orders/:orderId` your handler gets
`request.path.orderId` typed as a `string`.

| Pattern | Request | `request.path` |
| --- | --- | --- |
| `/orders/:orderId` | `/orders/9` | `{ orderId: '9' }` |
| `/orgs/:orgId/orders/:orderId` | `/orgs/acme/orders/9` | `{ orgId: 'acme', orderId: '9' }` |
| `/orgs/:orgId/orders` | `/orgs/acme/orders` | `{ orgId: 'acme' }` |
| `/orders/:orderId` | `/orders/9/items` | No match, a param stops at the next `/` |
| `/orders` | `/orders/` | `{}`, a trailing slash comes off both sides |
| `/orders/{orderId}` | `/orders/9` | No match |
| `/orders/{orderId}` | `/orders/{orderId}` | `{}` |
| `/files/:name.json` | `/files/report.json` | `{ name: 'report' }` |
| `/files/:name.json` | `/files/report.txt` | No match, `.json` is literal text |
| `/api/v:version` | `/api/v2` | `{ version: '2' }` |
| `/files/:name.:ext` | `/files/a.b.json` | `{ name: 'a.b', ext: 'json' }` |
| `/v1.0/orders` | `/v1X0/orders` | No match, the `.` is a literal dot |

The two `{name}` rows are traps rather than features.

**`{name}` is not path param syntax here.** It is a literal, which types nothing and matches only a request
for that exact string. Use `:orderId`.

**A `:` without a valid name after it throws when you register the route.** `/items/:1abc` and `/items/:`
both throw. TypeScript also flags them on the `path` filter, so you see the mistake in your editor first.

**A non-ASCII letter ends the name.** `/:café` has a param called `caf` followed by the literal text `é`.

**When two params share a segment, the first one takes any extra text.** `/files/:name.:ext` gives
`name` as `a.b` and `ext` as `json` for `/files/a.b.json`.

**A `.`, `+` or other regex metacharacter in a literal segment matches itself.** The literal parts of a
pattern are escaped before it is compiled to a regular expression, so `/v1.0/orders` matches `/v1.0/orders`
and nothing else.

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
    throw NotFound(`Order ${request.path.orderId} not found`)
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
| `body` | `TBody` | The parsed body. See [request body](#request-body) for when the router parses it. A body that is not valid JSON arrives as the raw string, a binary body as a `Buffer`, and no body at all as `null` |
| `rawBody` | `string \| undefined` | The body exactly as the service sent it, still base64 where `isBase64Encoded` is true |
| `isBase64Encoded` | `boolean` | Whether the service base64 encoded the body it sent |
| `headers` | `Record<string, string \| undefined>` | Request headers, lower cased by the router. Where a name repeats, this is the last value |
| `multiValueHeaders` | `Record<string, string[] \| undefined>` | Every value for each header, lower cased key |
| `auth` | `undefined` | ALB names no caller. See [Auth](#auth) |
| `event` | `TEvent` | The untouched `ALBEvent`, for `requestContext` and anything else you need |
| `context` | `Context` | The Lambda context |

`ALBEvent` and `Context` both come from `aws-lambda` rather than from this package, so import them from
there when you name them.

`path` holds the params rather than the path itself. Read `request.rawPath` when you want the string the
caller asked for.

The `Content-Type` header on the request decides the shape of `body`. The router decodes base64 for
you, so you never check the flag yourself.

| `Content-Type` | What you get in `body` |
| --- | --- |
| Anything holding `json`, `xml` or `yaml`, such as `application/json` or `application/vnd.api+json` | The parsed value, or the raw string when it will not parse |
| `text/*`, `application/x-www-form-urlencoded`, `application/javascript` or `application/graphql` | The string |
| Anything else, such as `image/png`, `application/gzip` or `application/octet-stream` | A `Buffer` of the bytes that were sent |

A route's body type stays the same however the caller sent it, so a route taking bytes gets a `Buffer`
whether or not the body arrived base64 encoded. See [binary bodies](#binary-bodies) for typing one.

A request with no `Content-Type` header gives you the string. The one exception is a base64 body holding
bytes utf-8 cannot carry, which you get as a `Buffer` because a string would lose them.

The router lowercases header names, so you read the header itself back as `request.headers['content-type']`.

`request.rawBody` holds the body exactly as the caller sent it, still base64 when `request.isBase64Encoded`
is true. You need it about as often as you need `request.event`.

Multi-value headers is a target group attribute. With it on the ALB sends `multiValueHeaders` and
`multiValueQueryStringParameters` in place of the single-value pair. The router reads both forms, so
`request.query` and `request.headers` come through the same either way. Where a name repeats, the flat
`query` and `headers` keep the last value and the full list lives on `request.multiValueQuery` and
`request.multiValueHeaders`.

If you have a param that can appear more than once, like `?tag=a&tag=b`, read `request.multiValueQuery.tag`
to get `['a', 'b']`. `request.query.tag` gives you `'b'`.

### Request body

The router parses the body only when the route needs it. This means a route that ignores the body does not
spend time or memory on `JSON.parse`.

| Route | When the router parses the body | `body` |
| --- | --- | --- |
| Any method with a `bodySchema` | Before the handler runs, to validate it | The schema output |
| `POST`, `PUT` or `PATCH` without a `bodySchema` | The first time something reads `request.body` | `unknown` |
| `GET`, `HEAD`, `DELETE` or `OPTIONS` without a `bodySchema` | Never | `undefined` |

A middleware that copies the request with `{ ...request }` reads `body`, so the parse happens there rather
than in the handler. It still happens only once.

### Response type

`HandlerResponse<T>` is `ApiResponse<T> | T | HTTPException`, where `T` is the body the route's
[response type](#response-types) takes. You can return the body on its own, a full
`{ statusCode, body, headers }` or an error helper. It defaults to a JSON body. See
[Responses](#responses) for what the router does with each.

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
  request: ApiRequest<{ orgId: string }, Record<string, string | undefined>, undefined, NewOrder>,
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

**The handler's annotation does not type the body on its own.** Only the `bodySchema` or the method does, so
`createOrder` above does not compile on a route without `bodySchema: NewOrderSchema`.
[Annotated handlers](/docs/handlers#annotated-handlers) has the worked version.

For the path you can do the same with `PathParams<'/orgs/:orgId/orders/:orderId'>`, which reads the params
out of the pattern so you are not keeping a second copy of it in step. Check it against [path
patterns](#path-patterns) first, since a pattern ending in a literal segment gives you nothing and writing
the type out by hand is the answer there.

`ApiRequest` takes its parameters in the order `TPath`, `TQuery`, `TAuth`, `TBody`, so typing only the body
means passing the query and auth types through as well. [Generic parameters](#generic-parameters) has each
one, its default and which types take them in a different order.

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
| `querySchema` | The query string params | 400, with the validation issues as the context |
| `bodySchema` | The parsed request body | 422, with the validation issues as the context |
| `responseSchema` | The body of every 2xx response the handler returns | 500 |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has matched,
so a request failing its schema gets an error response rather than falling through to the next route, and no
middleware runs. The query is checked first, so a request with a bad query and a bad body gets the 400.

Both failures put the issues array in the [error response](#error-responses) as its context, so on a
JSON route the caller sees the schema library's own messages and paths.

```json
{ "error": "Unprocessable content", "context": [{ "code": "invalid_type", "path": ["quantity"], "message": "Invalid input: expected number, received string" }] }
```

The handler receives the schema output. A `querySchema` of `z.object({ page: z.coerce.number().default(1) })`
hands `query.page` the number `2` for `?page=2` and `1` when the param is absent, and unknown keys are
stripped.

`responseSchema` checks every 2xx the handler returns, so `Ok(order)`,
`{ statusCode: 200, body: order }` and a bare `order` are all checked, and the caller gets the schema
output. A 204 is checked too, so `NoContent()` on a route whose schema needs a body answers 500. An
error or a redirect is sent without the check.

Its output has to match the route's kind, so a JSON route's `responseSchema` outputs a JSON body and an
HTML route's outputs `Html`.

### Binary bodies

A route that takes bytes says so with `BinaryBody`. It types `request.body` as a `Buffer` and answers 422
when the request's `Content-Type` is one the router reads as text.

```ts
import { BinaryBody, defineRoute, Ok } from '@lambda-event-router/alb'

export const uploadLabel = defineRoute({
  filters: { method: 'PUT', path: '/labels/:labelId' },
  bodySchema: BinaryBody,
}).handle(async (request) => Ok({ bytes: request.body.length }))
```

It is a Standard Schema like any other, so an [annotated handler](#annotated-handlers) works the same way.
Type its body as `Buffer` and a signature that disagrees with the schema fails the compile.

Leave the `bodySchema` off and `body` is `unknown`, which the compiler makes you narrow with
`Buffer.isBuffer(request.body)` before you can use it.

## Responses

Return a value and the router works out the status code, encodes the body and sets its content type.
What you can return depends on the route's [response type](#response-types), which is JSON unless you
say otherwise.

```ts
return { orderId: order.orderId }             // 200, with a JSON content type
return Ok({ orderId: order.orderId })         // The same 200
return { statusCode: 200, body: order }       // Also the same 200
```

On a JSON route:

| You return | You get |
| --- | --- |
| An object or an array, `{}` included | 200, with a JSON content type |
| `undefined` or `null` | 204 |
| A string, a number or a boolean | A compile error. At runtime it is JSON-encoded, so `'ok'` goes out as `"ok"` |
| A `Buffer`, a `Uint8Array` or an `ArrayBuffer` | A compile error, since bytes need a [binary route](#response-types) |
| A value JSON cannot carry, such as a function or an object that refers to itself | 500, and the router logs it |

A `Map` or a `Set` does not compile either, because `JSON.stringify` would send it as `{}`.

**Response headers go back in the form the request arrived in.** A target group with multi-value headers on
reads only `multiValueHeaders`, so the router sends that form for a request that came in with it and the
single-value form for one that did not.

### Response types

A route answers in one of four kinds. Set `responseType` on the router for its default and on a route
to override it, so one router can serve both pages and a JSON API.

```ts
import { createALBRouter, Html } from '@lambda-event-router/alb'

const albRouter = createALBRouter({
  responseType: 'html',
  errors: { html: ({ statusCode, statusText }) => Html(`<h1>${statusCode} ${statusText}</h1>`) },
})

albRouter
  .get({
    filters: { path: '/orders/:orderId' },
    handler: async ({ path }) => Html(nunjucks.render('order.njk', await orders.get(path.orderId))),
  })
  .get({
    filters: { path: '/api/orders/:orderId' },
    responseType: 'json',
    handler: async ({ path }) => orders.get(path.orderId),
  })
  .get({
    filters: { path: '/health' },
    responseType: 'text',
    handler: async () => 'ok',
  })
```

| Kind | The handler returns | Sent as | Default content type |
| --- | --- | --- | --- |
| `json` | An object, an array, `null` or `undefined` | JSON | `application/json` |
| `html` | `Html(...)` | The string as it is | `text/html; charset=utf-8` |
| `text` | A string | The string as it is | `text/plain; charset=utf-8` |
| `binary` | A `Buffer`, a `Uint8Array` or an `ArrayBuffer` | Base64, with `isBase64Encoded` set | `application/octet-stream` |

The compiler checks the handler against its kind, so a plain string on an HTML route or an object on a
text route fails the build. `Html()` is the only way to make an HTML body, which means a string never
reaches a page unless you wrap it. It takes a promise too, and then gives you a `Promise<Html>`.

**An HTML route needs `errors.html` on its router,** because no default error page could match your
site. Leave it out and the route fails the compile, and the router throws when you register it. See
[error responses](#error-responses) for writing one.

When the content type differs from the kind's default, pass `{ type, contentType }` instead. A `json`
kind takes only a JSON content type, such as `application/problem+json`, and the other kinds take
anything else.

```ts
albRouter.get({
  filters: { path: '/reports/orders.csv' },
  responseType: { type: 'text', contentType: 'text/csv' },
  handler: async () => orders.csv(),
})
```

An empty string on a text route is a 200 with an empty body, and `undefined` or `null` is a 204 on
every kind.

A `content-type` header on a single response sets the content type for that response alone, so a JSON
route can answer `Ok(problem, { 'content-type': 'application/problem+json' })`. Through `Ok()` and
`Created()` the compiler checks the header against the body: a JSON content type takes a JSON body, and
any other takes a string or bytes. The body still has to suit the route's kind, so a CSV string needs a
text route.

### Response helpers

Anything other than a 200 or a 204 goes through a helper, or you set the status code yourself. The
success helpers take the body. The error helpers take a message and a context, both optional, and the
router turns them into an [error response](#error-responses).

| Helper | Status | With no arguments |
| --- | --- | --- |
| `Ok(body, headers?)` | 200 | The body is required |
| `Created(body, headers?)` | 201 | The body is required |
| `NoContent()` | 204 | Empty |
| `TemporaryRedirect(location)` | 307 | Empty, with a `Location` header |
| `PermanentRedirect(location)` | 308 | Empty, with a `Location` header |
| `BadRequest(message?, context?, headers?)` | 400 | The message `Bad request` |
| `Unauthorised(message?, context?, headers?)` | 401 | The message `Unauthorised` |
| `Forbidden(message?, context?, headers?)` | 403 | The message `Forbidden` |
| `NotFound(message?, context?, headers?)` | 404 | The message `Not found` |
| `Conflict(message?, context?, headers?)` | 409 | The message `Conflict` |
| `UnprocessableContent(message?, context?, headers?)` | 422 | The message `Unprocessable content` |
| `InternalServerError(message?, context?, headers?)` | 500 | The message `Internal server error` |

On a JSON route the message goes out as `error`, and the context, when there is one, as `context`.

```ts
throw NotFound(`Order ${path.orderId} not found`)
// 404 {"error":"Order ord-1 not found"}

throw Conflict('Shipped orders cannot be cancelled', { orderId: path.orderId, status: order.status })
// 409 {"error":"Shipped orders cannot be cancelled","context":{"orderId":"ord-1","status":"SHIPPED"}}
```

The context can be any JSON value, and the compiler rejects one JSON cannot carry, such as a `Map`.

For an error status with no helper, throw an `HTTPException` with the status first. It takes only a 4xx
or 5xx, so any other status fails the compile. For any other status, return an `ApiResponse` yourself.
`HTTP_STATUS_CODES` is exported if you would rather not write the number.

```ts
import { HTTP_STATUS_CODES, HTTPException } from '@lambda-event-router/alb'

throw new HTTPException(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE, 'Down for maintenance', undefined, {
  'retry-after': '3600',
})

return { statusCode: HTTP_STATUS_CODES.ACCEPTED, body: { jobId } }
```

### Throwing

Throwing a helper works the same as returning it, and it carries the same weight from any depth, so a
function three calls below your handler can end the request without every function in between passing a
failure back up.

```ts
import { Conflict, NotFound } from '@lambda-event-router/alb'

const order = await orders.get(path.orderId)
if (!order) throw NotFound(`Order ${path.orderId} not found`)
if (order.status === 'SHIPPED') throw Conflict('Shipped orders cannot be cancelled')
```

**Anything else thrown becomes a 500 with `Internal server error` as the message.** The router logs the
error with its own message, so a `new Error('connect ETIMEDOUT 10.0.1.5:8000')` ends up in your logs
and never on the wire.

A 502 reaching the client is the load balancer rather than anything on this page. An ALB answers 502 of its
own accord when a Lambda returns a shape it cannot read, or when the function errors outside the router.

### Error responses

The router builds every error response the same way, whether a handler threw a helper or the router hit
the error itself.

| Error | Status | `message` | `context` |
| --- | --- | --- | --- |
| No route matched | 404 | `Not found` | None |
| Auth missing | 401 | `Unauthorised` | None |
| Auth invalid | 403 | `Forbidden` | None |
| Auth preset error | 500 | `Internal server error` | None |
| Query fails `querySchema` | 400 | `Bad request` | The schema issues |
| Body fails `bodySchema` | 422 | `Unprocessable content` | The schema issues |
| Response fails `responseSchema` | 500 | `Internal server error` | None |
| Anything else thrown | 500 | `Internal server error` | None |
| An error helper or `HTTPException` | Its status | Yours, or the helper's default | Yours |

With no error function of your own, a JSON route sends the message as `error` and adds the context as
`context` when there is one. A text route sends the message on its own.

```json
{ "error": "Unprocessable content", "context": [{ "code": "invalid_type", "path": ["quantity"], "message": "Invalid input: expected number, received string" }] }
```

To send your own shape, set `errors` on the router with a function per kind. `json` and `text` are
optional, and `html` is required on a router with any HTML route.

```ts
import { createALBRouter, Html } from '@lambda-event-router/alb'

const albRouter = createALBRouter({
  responseType: 'html',
  errors: {
    html: ({ statusCode, statusText }) => Html(`<h1>${statusCode} ${statusText}</h1>`),
    json: ({ statusCode, message, context }) => ({ statusCode, error: message, details: context }),
  },
})
```

The `html` function above returns only an `<h1>` heading. To send a full HTML page, use a template engine
such as Nunjucks.

Each function gets the same input and returns only the body. The status comes from the error, and the
headers from the `HTTPException` or helper that raised it.

| Field | Type | Description |
| --- | --- | --- |
| `statusCode` | `ErrorStatusCode` | The status, from 400 to 599 |
| `statusText` | `string` | The name of the status, such as `Not Found` |
| `message` | `string` | The message the error was given, or its default |
| `context` | `ErrorContext \| undefined` | The context the error was given, or the schema issues for a 400 or 422 |

The router calls the function for the route's kind, and the router's kind for a 404 that matched no
route. A binary route never sends bytes as an error, so it uses the router's kind, and a binary router
uses JSON.

An error response takes its kind's default content type rather than the route's, so a `text/csv`
route's 404 is `text/plain`. Set a `content-type` in the exception's headers to change it.

**If an error function throws, the router logs it and answers a 500 it builds itself.** A JSON route
gets `{"error":"Internal server error"}`, and every other kind gets the plain text
`Internal server error`.

CORS headers and the `HEAD` rule apply to every error response.

## Auth

`request.auth` is always `undefined` on this router, because an ALB puts no caller on the event. The ARN of
the target group the request came through is on the raw event, as
`request.event.requestContext.elb.targetGroupArn`.

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

A middleware can also short-circuit by returning or throwing an error helper instead of calling `next`,
so an auth check or a maintenance window can answer without the handler running.

The bare alias is the right one for router middleware, which runs for every route and so cannot know any one
route's shape. That is where a check like the one above belongs.

**The bare alias cannot answer with a body of its own,** since it runs on routes of every
[response type](#response-types). It can return what `next()` gives it or an error helper, and nothing
else compiles. A middleware that reads or builds a body names it as the fifth parameter, so
`HTTPMiddleware<..., JsonBody>` fits only JSON routes and never a router.

**On a route, the bare alias pins the route's types and the handler quietly loses them.** `HTTPMiddleware`
with no parameters defaults `path` to `Record<string, string>`, `query` to the raw query and `body` to
`unknown`, and attaching it overrides whatever the path pattern and the schemas would have given the
handler. A route with `path: '/orgs/:orgId/orders'` and a `bodySchema` still compiles with a bare alias
attached, and its handler gets neither `path.orgId` nor the schema's body.

Spell the parameters out to match the route, in the order [`TPath`, `TQuery`, `TAuth`,
`TBody`](#generic-parameters).

```ts
export const withOrgContext: HTTPMiddleware<
  { orgId: string; orderId: string },
  Record<string, string | undefined>,
  undefined,
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
| `ApiRequest<TPath, TQuery, TAuth, TBody, TEvent>` | The handler argument |
| `HandlerResponse<TResponse>` | Handler return type, `ApiResponse<TResponse> \| TResponse \| HTTPException` |
| `ApiResponse<T>` | `{ statusCode, body, headers? }` |
| `HTTPResponse<T>` | An alias of `ApiResponse<T>`, and what the helpers return |
| `ApiHandler<TPath, TQuery, TAuth, TBody, TResponse>` | The handler signature |
| `RouteDefinition<TPathString, TPath, TQuery, TAuth, TBody, TResponse, TMethod>` | A full route passed to `route()` |
| `PathParams<TPathString>` | The params a pattern names, so `PathParams<'/orders/:orderId'>` is `{ orderId: string }` |
| `JsonBody` | What a JSON route returns: an object, an array, `null` or `undefined` |
| `Html` | An HTML body, which only `Html()` makes |
| `Bytes` | `Uint8Array \| ArrayBuffer`, which a binary route returns along with a `Buffer` |
| `ResponseKind` | `'json' \| 'html' \| 'text' \| 'binary'` |
| `ResponseTypeOption` | The `responseType` option, a kind or `{ type, contentType }` |
| `ResponseBody<TKind>` | The body a kind returns. With no argument, the body of any kind |
| `ErrorFunctions` | The `errors` option |
| `ErrorInput` | What an error function gets, `{ statusCode, statusText, message, context }` |
| `ErrorContext` | Any JSON value, which an error helper takes as its context |
| `ErrorStatusCode` | A 4xx or 5xx status, which `HTTPException` takes |
| `CorsConfig` | The `cors` option |
| `CorsOriginFunction` | A dynamic `origin`, `(origin, path) => string \| undefined` |
| `ALBRouterOptions` | Options for `createALBRouter` |
| `AnyHttpMethod` | What the `method` filter accepts, upper or lower case |
| `HttpMethod` | The upper case methods |

`ALBEvent` and `ALBResult` are not re-exported, so `request.event` is typed by `aws-lambda` and you import
those two from there.

`HTTPFilters`, `HTTPFilterInput` and `HTTPMiddleware` come from `@lambda-event-router/http`, with `TAuth`
defaulting to `undefined` here, so import them from here rather than naming that package. The route definition
and request types carry no `ALB` prefix because `APIGatewayRouter` and `VPCLatticeRouter` use the same
ones.

The `ALBRouter` class and the `createALBRouter` and `defineRoute` functions come from the same place, along
with the `Response` class, the response helpers, `Html`, `HTTPException`, `HTTP_STATUS_CODES`, `BinaryBody`
and `albAdapter`.

`HTTPRouter`, `NormalizedHTTPEvent`, `FinalizedHTTPResponse` and `HTTPAdapter` are exported for writing
an adapter of your own and pairing it with a router, and are not something a route needs. An ALB sends
one event shape, so unlike API Gateway and Lattice there is no payload version to pin a router to.

### Generic parameters

Eight parameters cover every type above, and they do not all appear in the same order.

| Parameter | Types | Default |
| --- | --- | --- |
| `TPathString` | The path pattern itself, which `PathParams` reads | `string` |
| `TPath` | `request.path` | `PathParams<TPathString>` on `RouteDefinition`, `Record<string, string>` elsewhere |
| `TQuery` | `request.query` | `Record<string, string \| undefined>` |
| `TAuth` | `request.auth` | `undefined` |
| `TBody` | `request.body` | `unknown`. On a route without a `bodySchema`, `TMethod` picks `unknown` or `undefined` |
| `TMethod` | The `method` filter on `RouteDefinition` | `AnyHttpMethod` |
| `TResponse` | What the handler returns | `JsonBody` |
| `TEvent` | `request.event` | `unknown` |

`ApiRequest`, `ApiHandler` and `HTTPMiddleware` all start `TPath, TQuery, TAuth, TBody`. `ApiRequest`'s fifth
is `TEvent` while the other two take `TResponse`. `RouteDefinition` puts `TPathString` first and derives
`TPath` from it. It takes `TMethod` last.

Pass only the ones you need up to the last one you care about, so `ApiRequest<{ orderId: string }>` types the
path and leaves the query, auth and body loose.

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
    throw NotFound(\`Order \${orderId} not found\`)
  }

  return Ok(order)
}

export async function createOrder(
  request: ApiRequest<OrgPath, Record<string, string | undefined>, undefined, NewOrder>,
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

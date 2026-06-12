# LambdaAuthorizerRouter

`LambdaAuthorizerRouter` routes Amazon API Gateway Lambda authorizer events to handlers, one
authorization request per invocation.

Your handler decides whether a caller gets through and returns the IAM policy API Gateway acts on. One
API can have several authorizers pointing at the same function, so routes match on which authorizer
sent the event and on the method being called.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/apigateway
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createLambdaAuthorizerRouter } from '@lambda-event-router/apigateway'
import { withTiming } from './middleware/withTiming'

const authRouter = createLambdaAuthorizerRouter({
  middleware: [withTiming],  // Optional
})
```

`middleware` is the only option and it can be left out. An authorizer runs before API Gateway builds a
response, so there is no CORS to answer here, and everything else this router does is set on the
routes. See [Middleware](#middleware).

## Register routes

```ts
authRouter.route({
  filters: {
    type: 'REQUEST',  // Optional
    method: 'POST',  // Optional
  },
  middleware: [withAudit],  // Optional
  handler: authoriseWrite,
})
```

`filters` and `handler` are the only required keys, and every key inside `filters` is optional, so
`filters: {}` registers a catch-all.

A route has no schema key. An authorizer is handed a token and the metadata of a request someone else
is making, rather than a payload you control, so there is nothing to validate.

`route()` returns the router, so you can chain registrations.

```ts
authRouter.route(tokenRoute).route(readRoute).route(writeRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. A catch-all registered first swallows every event behind it. See [match
order](/docs/routing#match-order) for what goes wrong when they overlap.

**When nothing matches, the router throws and the invocation fails.** The message names the type and
the method it could not place, and no handler runs. A failed authorizer is an error rather than a
refusal, so the caller gets neither the resource nor a clean denial. See [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

### Convenience methods

`token()` and `request()` fill in the `type` filter for you.

```ts
// Both of these register the same route
authRouter.request({
  method: 'GET',
  handler: authoriseRead,
})

authRouter.route({
  filters: { type: 'REQUEST', method: 'GET' },
  handler: authoriseRead,
})
```

| Method | Sets | Also takes | Handler gets |
| --- | --- | --- | --- |
| `token()` | `type: 'TOKEN'` | `handler` | `LambdaAuthorizerTokenRequest` |
| `request()` | `type: 'REQUEST'` | `method`, `handler` | `LambdaAuthorizerRequestRequest` |

`request()`'s `method` sits at the top level rather than inside `filters`, and `token()` takes a
`handler` and nothing else. Neither accepts a `custom`, so a route needing one goes through
`route()` or `defineLambdaAuthorizerRoute`. See [convenience
methods](/docs/routing#convenience-methods) for how the other routers use them.

**Both methods narrow what the handler is given, and `route()` does not.** `route()` types its handler
against `LambdaAuthorizerRequest`, where everything but `type`, `resourceArn`, `event` and `context` is
optional, so a function annotated `LambdaAuthorizerTokenRequest` will not assign to it. [Annotated
handlers](#annotated-handlers) has the two ways round that.

## Filters

Two keys match on the event, plus a `custom`. Every one of them is optional.

```ts
authRouter.route({
  filters: {
    type: 'REQUEST',
    method: 'POST',
  },
  handler: authoriseWrite,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `type` | `'TOKEN' \| 'REQUEST'` | Which kind of authorizer sent the event. One value, not a `FilterStringMatcher`, so no array and no pattern |
| `method` | `string` | The method of the request being authorised. An exact match and case sensitive, so `GET` rather than `get` |
| `custom` | `(input: LambdaAuthorizerFilterInput) => boolean \| Promise<boolean>` | Given `{ type, method }`. Can be async |

Neither key is a [`FilterStringMatcher`](/docs/routing#filters), so neither takes an array or a
`RegExp` the way `bucket` on S3 or `messageAttributes` on SNS do. `type` has only two values to pick
between, and `method` matches one method per route.

**`method` and a `custom` reading the method do not belong in the same block.** By the time the
custom filter runs, `method` has already narrowed the route to one value, so anything the function adds
is unreachable. Use one or the other.

Matching a group of methods is where the `custom` earns its place, since
`{ method: 'POST' }` and `{ method: 'PUT' }` are two registrations while one function covers both.

```ts
authRouter.route({
  filters: {
    type: 'REQUEST',
    custom: ({ method }) => method === 'POST' || method === 'PUT',
  },
  handler: authoriseWrite,
})
```

`custom` gets the same two values the keys above match and nothing else, so it cannot read the
token, the headers or the raw event. Filter on the type and the method, and check the rest in the
handler. See [`custom`](/docs/routing#custom) for where it sits in the filter order.

**A `method` filter never matches a TOKEN event.** A token authorizer is configured against a header
rather than a route, so the event carries no method and `{ type: 'TOKEN', method: 'GET' }` matches
nothing at all. The same goes for a `custom` testing `method`, which is `undefined` on every
TOKEN event.

### Authorizer types

`type` is set by AWS on the event and tells you which of two contracts you are working to. A TOKEN
authorizer is given a single header value and nothing about the request. A REQUEST authorizer is given
the request and no token, so a bearer token there is read off `headers.authorization`.

| Where it runs | `type` | `resourceArn` is | Simple response |
| --- | --- | --- | --- |
| REST API, token source | `TOKEN` | `methodArn` | No |
| REST API, request parameters | `REQUEST` | `methodArn` | No |
| HTTP API, payload format 1.0 | `REQUEST` | `methodArn` | No |
| HTTP API, payload format 2.0 | `REQUEST` | `routeArn` | Yes |

The router normalises all four into one request object, so `resourceArn`, `method` and `path` read the
same whichever arrived.

**There is no filter for the payload version.** A `request()` route takes both HTTP API formats and the
REST API's request authorizer, and the only difference your handler sees is whether it may answer with
a boolean, which [Simple responses](#simple-responses) covers.

## Handler

Handlers take one argument and return the policy API Gateway should act on.

```ts
import type { APIGatewayAuthorizerResult } from 'aws-lambda'
import type { LambdaAuthorizerTokenRequest } from '@lambda-event-router/apigateway'
import { Allow, Deny } from '@lambda-event-router/apigateway'

export async function authoriseToken(request: LambdaAuthorizerTokenRequest): Promise<APIGatewayAuthorizerResult> {
  const { authorizationToken, resourceArn } = request

  const user = await users.fromToken(authorizationToken)
  if (!user) return Deny('anonymous', resourceArn)

  return Allow(user.id, resourceArn, { tenantId: user.tenantId })
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `type` | `AuthorizerType` | `'TOKEN'` or `'REQUEST'` |
| `resourceArn` | `string` | The ARN of what is being called. Scope the policy you return to it |
| `authorizationToken` | `string` | The raw token source value, `Bearer eyJ...` and all. Only a TOKEN authorizer carries one |
| `method` | `string` | The method of the request being authorised. Only a REQUEST authorizer |
| `path` | `string` | The path being called. Only a REQUEST authorizer |
| `headers` | `Record<string, string \| undefined>` | The request headers. Only a REQUEST authorizer |
| `query` | `Record<string, string \| undefined>` | The query string parameters, `{}` when there are none. Only a REQUEST authorizer |
| `event` | `LambdaAuthorizerEvent` | The untouched event from AWS, for the request context and anything else you need |
| `context` | `Context` | The Lambda context |

`Context` comes from `aws-lambda`, not from this package. `LambdaAuthorizerEvent` types `event` and is
exported from here, as a union of that package's three authorizer event types.

**Header names arrive lowercased.** The router lowercases a REST API's and an HTTP API sends them that
way already, so `headers.authorization` and `headers['x-api-key']` are the spellings to read.

Which of the optional fields you actually get is fixed by the authorizer type, and the request types
say so, so a handler registered through [`token()` or `request()`](#convenience-methods) reads them
without a check.

### Response type

A handler returns `LambdaAuthorizerResult`, a union of `APIGatewayAuthorizerResult` and
`APIGatewaySimpleAuthorizerResult`. A `boolean` works as shorthand for the second. Both come from
`aws-lambda`, and [`Allow` and `Deny`](#policy-helpers) build the first. See [Responses](#responses)
for what the router does with each.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineLambdaAuthorizerRoute` reads the `type` filter
and hands your handler the matching request, so `authorizationToken` below is a `string` rather than
`string | undefined` without you declaring anything.

```ts
import { Allow, defineLambdaAuthorizerRoute, Deny } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'

export const tokenRoute = defineLambdaAuthorizerRoute({
  filters: { type: 'TOKEN' },
}).handle(async ({ authorizationToken, resourceArn }) => {
  const [scheme, token] = authorizationToken.split(' ')
  if (scheme !== 'Bearer' || !token) return Deny('anonymous', resourceArn)

  const user = await users.fromToken(token)
  if (!user) {
    logger.warn(`Rejected a token for ${resourceArn}`)
    return Deny('anonymous', resourceArn)
  }

  return Allow(user.id, resourceArn, { tenantId: user.tenantId })
})

authRouter.route(tokenRoute)
```

**The `type` filter is what picks the request shape.** `{ type: 'TOKEN' }` infers
`LambdaAuthorizerTokenRequest`, `{ type: 'REQUEST' }` infers `LambdaAuthorizerRequestRequest`, and a
route without a `type` infers `LambdaAuthorizerRequest` with everything optional. The convenience
methods narrow the same way, since each sets the filter itself.

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using one of the three request
types on [Types](#types) and your own.

```ts
// handlers/auth.ts
import type { APIGatewayAuthorizerResult } from 'aws-lambda'
import type { LambdaAuthorizerRequestRequest } from '@lambda-event-router/apigateway'
import { Allow, Deny } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'

export async function authoriseRead(request: LambdaAuthorizerRequestRequest): Promise<APIGatewayAuthorizerResult> {
  const { headers, method, path, resourceArn } = request

  const key = headers['x-api-key']
  if (!key) return Deny('anonymous', resourceArn)

  const client = await apiKeys.lookup(key)
  if (!client) {
    logger.warn(`Rejected an API key for ${method} ${path}`)
    return Deny('anonymous', resourceArn)
  }

  return Allow(client.id, resourceArn, { plan: client.plan })
}
```

```ts
// authorizer.ts
import { createLambdaAuthorizerRouter } from '@lambda-event-router/apigateway'

import { authoriseRead } from './handlers/auth.js'

const authRouter = createLambdaAuthorizerRouter()

authRouter.request({ method: 'GET', handler: authoriseRead })
```

**A narrow request type only assigns through `token()` or `request()`.** Registering the same handler
with `route()` is rejected, because `route()` types its handler against `LambdaAuthorizerRequest`
whatever the route filters to. Use the convenience method, or annotate the handler
`LambdaAuthorizerRequest` and check the optional fields yourself.

There is no schema on a route to derive a type from, so the request types are the whole surface and the
only thing you write yourself is the return type. [Annotated
handlers](/docs/handlers#annotated-handlers) has the worked version.

## Responses

Whatever a handler returns goes back to API Gateway as the result of the invocation. An IAM policy
works everywhere, and a boolean works on one of the four authorizer configurations.

### Policy helpers

`Allow` and `Deny` build the policy document API Gateway expects, so you pass the principal and the
resource rather than writing the statement out.

```ts
import { Allow, Deny } from '@lambda-event-router/apigateway'

return Allow('user-123', resourceArn)
return Allow('user-123', resourceArn, { tenantId: 'acme', plan: 'pro' })
return Deny('anonymous', resourceArn)
```

| Helper | Effect | Third argument |
| --- | --- | --- |
| `Allow(principalId, resource, context?)` | `Allow` | A `Record<string, string \| number \| boolean>` passed through to your API |
| `Deny(principalId, resource)` | `Deny` | None |
| `generatePolicy(principalId, effect, resource)` | Whichever you pass | The resource, since the effect takes the second slot |

`generatePolicy` is the one to reach for when the effect is a variable rather than a branch, and
`Allow` is the only one taking a context.

Whatever you put in that context reaches the handler behind the API on
[`request.auth`](/routers/APIGatewayRouter#auth), which is how an authorizer passes a tenant id or a
plan on without the API looking it up again. API Gateway passes the values through as strings, so a
number goes out as `3` and arrives as `'3'`.

**Scope the resource to what you mean to allow, and remember the policy can be cached.** The
`resourceArn` off the request names one method on one route, so a policy built from it allows that and
nothing else. Where the API caches authorizer results, the cached policy is reused for the identity's
next request, and one pinned to a single ARN then refuses it. A wildcard such as
`arn:aws:execute-api:eu-west-2:123456789012:abc123/prod/*/*` covers the API instead, at the cost of the
policy no longer being per route.

Both helpers take a single resource string, so a policy naming several ARNs without a wildcard means
building the document yourself.

### Simple responses

An HTTP API request authorizer on payload format 2.0 can answer with a boolean, and the router wraps it
as `{ isAuthorized }`.

```ts
return true   // { isAuthorized: true }
return false  // { isAuthorized: false }
```

**Returning a boolean from anything else throws and fails the invocation.** A REST API authorizer and
an HTTP API on payload format 1.0 both expect a policy, so the router refuses the boolean rather than
sending something API Gateway cannot read. Nothing catches this at compile time, because the return
type allows a boolean on every route.

No filter reaches the payload version, so a route covering both HTTP API formats has to return a
policy. Answer with a boolean only where the authorizer is pinned to 2.0.

### Throwing

Throwing a policy works the same as returning it, and it carries the same weight from any depth, so a
token check three calls below your handler can refuse a request without every function in between
passing a failure back up.

```ts
import { Deny } from '@lambda-event-router/apigateway'

const user = await users.fromToken(token)
if (!user) throw Deny('anonymous', resourceArn)
```

**Only a policy is caught.** The router checks a thrown value for a `principalId` and a
`policyDocument`, so a thrown `{ isAuthorized: false }` is not a response and fails the invocation.
Return the boolean rather than throwing it. `isAuthorizerResponse` is that check, exported so you can
run it yourself.

**Anything else thrown fails the invocation.** The router rethrows it untouched, so Lambda records the
error and the caller gets an error from API Gateway rather than a refusal. A denial you mean is a
`Deny`, not a `throw new Error('unauthorised')`.

## Middleware

Router and route middleware are both typed `LambdaAuthorizerMiddleware`, and the chain runs once per
authorisation.

```ts
import type { LambdaAuthorizerMiddleware } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'

export const withTiming: LambdaAuthorizerMiddleware = async (request, next) => {
  logger.appendKeys({ resourceArn: request.resourceArn })

  return next(request)
}
```

```ts
const authRouter = createLambdaAuthorizerRouter({ middleware: [withTiming] })

authRouter.route({
  filters: { type: 'REQUEST', method: 'POST' },
  middleware: [withAudit],
  handler: authoriseWrite,
})
```

Router middleware runs before route middleware, and both run before the handler. A middleware can
short-circuit by returning a policy or a boolean without calling `next`, and a response thrown from
inside the chain, with `Deny()` or `Allow()`, is caught the same way a throw from the handler is. See
[middleware](/docs/middleware) for the execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/apigateway`.

| Type | Description |
| --- | --- |
| `LambdaAuthorizerRequest` | The handler argument, with every field only one authorizer type carries optional |
| `LambdaAuthorizerTokenRequest` | The same for a TOKEN authorizer, with `authorizationToken` required |
| `LambdaAuthorizerRequestRequest` | The same for a REQUEST authorizer, with `method`, `path`, `headers` and `query` required |
| `LambdaAuthorizerBaseRequest` | The four fields all three share |
| `LambdaAuthorizerResult` | What the router hands back to Lambda |
| `LambdaAuthorizerHandler` | A handler, as `route()` types it |
| `LambdaAuthorizerMiddleware` | Router and route middleware |
| `LambdaAuthorizerRouteDefinition` | A full route, as `defineLambdaAuthorizerRoute` builds it |
| `LambdaAuthorizerRouterOptions` | Options for `createLambdaAuthorizerRouter` |
| `LambdaAuthorizerTokenInput` | The argument to `token()` |
| `LambdaAuthorizerRequestInput` | The argument to `request()` |
| `LambdaAuthorizerFilters` | The `filters` key |
| `LambdaAuthorizerFilterInput` | What a `custom` is given |
| `LambdaAuthorizerEvent` | `request.event` |
| `AuthorizerType` | `'TOKEN' \| 'REQUEST'` |

`Context` on the request comes from `aws-lambda`, and so do the three events `LambdaAuthorizerEvent`
unions together and both halves of `LambdaAuthorizerResult`. `Allow`, `Deny` and `generatePolicy` all
return that package's `APIGatewayAuthorizerResult`, which is what to annotate a handler's return type
with.

None of these takes a generic parameter. A route carries no schema, so there is nothing for a type to
pass through, and the request shape comes from the `type` filter instead.

The `LambdaAuthorizerRouter` class and the `createLambdaAuthorizerRouter` and
`defineLambdaAuthorizerRoute` functions come from the same place, along with `Allow`, `Deny`,
`generatePolicy` and `isAuthorizerResponse`.

## Code example

One Lambda backing three authorizers on the same API: a token authorizer on the REST API, and request
authorizers for reads and for writes.

Open a file: [index.ts](#authorizer-example:index.ts) | [authorizer router](#authorizer-example:authorizer.ts) | [handlers](#authorizer-example:handlers/auth.ts) | [lookups](#authorizer-example:accounts.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { authRouter } from './authorizer.js'

const lambdaRouter = new LambdaRouter({
  routers: [authRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'authorizer.ts',
    code: `import { createLambdaAuthorizerRouter, defineLambdaAuthorizerRoute } from '@lambda-event-router/apigateway'

import { authoriseRead, authoriseToken, authoriseWrite } from './handlers/auth.js'

export const authRouter = createLambdaAuthorizerRouter()

authRouter
  .token({ handler: authoriseToken })
  .request({ method: 'GET', handler: authoriseRead })
  .route(
    defineLambdaAuthorizerRoute({
      filters: {
        type: 'REQUEST',
        custom: ({ method }) => method !== 'GET',
      },
    }).handle(authoriseWrite),
  )`,
  },
  {
    path: 'handlers/auth.ts',
    code: `import type { APIGatewayAuthorizerResult } from 'aws-lambda'
import type {
  LambdaAuthorizerRequestRequest,
  LambdaAuthorizerTokenRequest,
} from '@lambda-event-router/apigateway'
import { Allow, Deny } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'

import { apiKeys, users } from '../accounts.js'

export async function authoriseToken(request: LambdaAuthorizerTokenRequest): Promise<APIGatewayAuthorizerResult> {
  const { authorizationToken, resourceArn } = request

  const [scheme, token] = authorizationToken.split(' ')
  if (scheme !== 'Bearer' || !token) {
    logger.warn(\`Rejected a \${scheme} credential on \${resourceArn}\`)
    return Deny('anonymous', resourceArn)
  }

  const user = await users.fromToken(token)
  if (!user) {
    return Deny('anonymous', resourceArn)
  }

  return Allow(user.id, resourceArn, { tenantId: user.tenantId })
}

export async function authoriseRead(request: LambdaAuthorizerRequestRequest): Promise<APIGatewayAuthorizerResult> {
  const { headers, path, resourceArn } = request

  const client = await apiKeys.lookup(headers['x-api-key'])
  if (!client) {
    logger.warn(\`Rejected an API key reading \${path}\`)
    return Deny('anonymous', resourceArn)
  }

  return Allow(client.id, resourceArn, { tenantId: client.tenantId, plan: client.plan })
}

export async function authoriseWrite(request: LambdaAuthorizerRequestRequest): Promise<APIGatewayAuthorizerResult> {
  const { headers, method, path, resourceArn } = request

  const client = await apiKeys.lookup(headers['x-api-key'])
  if (!client) {
    logger.warn(\`Rejected an API key on \${method} \${path}\`)
    return Deny('anonymous', resourceArn)
  }

  // Reads are open to every plan, writes are not
  if (client.plan === 'free') {
    logger.info(\`Client \${client.id} is on the free plan and cannot \${method}\`)
    return Deny(client.id, resourceArn)
  }

  return Allow(client.id, resourceArn, { tenantId: client.tenantId, plan: client.plan })
}`,
  },
  {
    path: 'accounts.ts',
    code: `interface User {
  id: string
  tenantId: string
}

interface Client {
  id: string
  tenantId: string
  plan: 'free' | 'pro'
}

export const users = {
  async fromToken(token: string): Promise<User | undefined> {
    // Verify the JWT and load whoever it belongs to
    return { id: 'user-123', tenantId: 'acme' }
  },
}

export const apiKeys = {
  async lookup(key: string | undefined): Promise<Client | undefined> {
    if (!key) return undefined

    // Look the key up in whatever holds them
    return { id: 'client-456', tenantId: 'acme', plan: 'pro' }
  },
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="authorizer-example" default-file="authorizer.ts" line-numbers collapse-toggle fixed-height />

Every route carries a filter no other route can match, so the order they are registered in makes no
difference. `GET` is picked by the `method` filter and every other method by the `custom` beside
it, which is the one thing a single `method` key cannot express.

All three handlers answer with a policy rather than a boolean. A route cannot filter on the payload
version, so a boolean would fail on anything but an HTTP API pinned to 2.0.

`authoriseRead` and `authoriseWrite` reach their narrow request type two different ways: `request()`
narrows it for you, and `defineLambdaAuthorizerRoute` infers it from the `type` filter. Handing either
handler to `route()` instead would not compile.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

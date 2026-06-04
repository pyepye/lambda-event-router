# AppSyncAuthorizerRouter

`AppSyncAuthorizerRouter` routes AWS AppSync Lambda authorizer events to a handler, one authorisation
request per invocation.

AppSync calls your function before every query and mutation, hands it the token the client sent and
waits for a yes or no. Your handler returns that decision, along with anything the resolvers behind it
should know about the caller.

## Install

```bash
npm install @lambda-event-router/appsync
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

## Create the router

```ts
import { createAppSyncAuthorizerRouter } from '@lambda-event-router/appsync'
import { withRequestContext } from './middleware/withRequestContext'

const authRouter = createAppSyncAuthorizerRouter({
  middleware: [withRequestContext],  // Optional
})
```

`middleware` is the only option and it can be left out. `createAppSyncAuthorizerRouter()` on its own
gives you a router with no shared middleware, see [Middleware](#middleware).

## Register routes

```ts
authRouter.route({
  middleware: [withRequestContext],   // Optional
  handler: authoriseRequest,
})
```

`handler` is required and `middleware` is optional, and there are no filters. An API set to
`AWS_LAMBDA` authorisation has a single authorizer function and every query and mutation goes through
it, so there is nothing to route on. Branching on the caller or the operation happens inside the
handler instead.

A route has no schema key either. An authorizer is given a token and the text of a query someone else
wrote, rather than a payload you control, so there is nothing to validate.

**A second `route()` call replaces the first.** The router holds one route rather than a list, so
registering twice leaves you with the second handler and nothing warns you. `route()` still returns the
router, so a chain compiles and quietly discards everything but its last link.

**When no route is registered, the router throws `No authorizer route registered` and the invocation
fails.** AppSync reads a failed authorizer invocation as a refusal, so the caller gets an
`UnauthorizedException` rather than an error. See [nothing matched](/docs/routing#nothing-matched) for
what the other routers do instead.

## Handler

Handlers take one argument and return the decision AppSync acts on. A handler has to be async, since
the route type asks for a `Promise`.

```ts
import type { AppSyncAuthorizerResult } from 'aws-lambda'
import type { AppSyncAuthorizerRequest } from '@lambda-event-router/appsync'
import { Authorized, Denied } from '@lambda-event-router/appsync'

export async function authoriseRequest(
  request: AppSyncAuthorizerRequest,
): Promise<AppSyncAuthorizerResult<Record<string, unknown>>> {
  const { authorizationToken } = request

  const user = await users.fromToken(authorizationToken)
  if (!user) return Denied()

  return Authorized({ resolverContext: { userId: user.id, tenantId: user.tenantId } })
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `authorizationToken` | `string` | What the client sent in the `Authorization` header, untouched |
| `requestHeaders` | `Record<string, string \| undefined>` | The headers the client sent to AppSync |
| `apiId` | `string` | The API the request arrived on. Worth reading where one function authorises several |
| `accountId` | `string` | The account that API belongs to |
| `requestId` | `string` | The AppSync request id, which makes a useful log key |
| `queryString` | `string` | The raw GraphQL document, which can hold more than one operation |
| `operationName` | `string \| undefined` | Which operation in that document is running |
| `variables` | `Record<string, unknown>` | The variables sent with the operation |
| `event` | `AppSyncAuthorizerEvent` | The untouched event from AWS |
| `context` | `Context` | The Lambda context |

`AppSyncAuthorizerEvent` and `Context` both come from `aws-lambda` rather than from this package.

**Header names arrive exactly as AppSync sends them.** The router passes `requestHeaders` on without
lowercasing the keys, so `requestHeaders.authorization` and `requestHeaders.Authorization` are two
different reads. The credential is on `authorizationToken` whatever the casing, which is the field to
reach for.

**A subscription's connect request carries the operation name `DeepDish:Connect`.** AppSync sets that
value itself, so a handler branching on `operationName` has to allow for it or every WebSocket
connection gets refused.

`operationName` arrives `undefined` when the client does not name the operation, since AppSync leaves
the field off the event. The client picks both the name and the document text, so a decision that has
to hold belongs on the token rather than on either of them.

### Response type

A handler returns `AppSyncAuthorizerResult<Record<string, unknown>>`, which comes from `aws-lambda`.
The router pins that generic parameter, so `resolverContext` is a `Record<string, unknown>` on every
route. [`Authorized` and `Denied`](#response-helpers) build the value.

### Inferred handlers

`defineAuthorizerRoute()` hands your handler the request without you naming its type, so there is
nothing to look up and nothing to keep in sync.

```ts
import { Authorized, defineAuthorizerRoute, Denied } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

export const authorizerRoute = defineAuthorizerRoute().handle(async ({ authorizationToken, requestId }) => {
  const user = await users.fromToken(authorizationToken)
  if (!user) {
    logger.warn(`Rejected the token on request ${requestId}`)
    return Denied()
  }

  return Authorized({ resolverContext: { userId: user.id, tenantId: user.tenantId } })
})

authRouter.route(authorizerRoute)
```

**The builder is `defineAuthorizerRoute`, not `defineRoute`.** The package holds three routers and
`defineRoute` belongs to [`AppSyncRouter`](/routers/AppSyncRouter), so the authorizer's builder carries
its own name. It takes an optional config for route `middleware`, and a route has no filters or schemas
for it to read.

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`AppSyncAuthorizerRequest`](#types) and the result type from `aws-lambda`.

```ts
// handlers/authorise.ts
import type { AppSyncAuthorizerResult } from 'aws-lambda'
import type { AppSyncAuthorizerRequest } from '@lambda-event-router/appsync'
import { Authorized, Denied } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

export async function authoriseRequest(
  request: AppSyncAuthorizerRequest,
): Promise<AppSyncAuthorizerResult<Record<string, unknown>>> {
  const { authorizationToken, requestId } = request

  const user = await users.fromToken(authorizationToken)
  if (!user) {
    logger.warn(`Rejected the token on request ${requestId}`)
    return Denied()
  }

  return Authorized({ resolverContext: { userId: user.id, tenantId: user.tenantId } })
}
```

```ts
// authorizer.ts
import { createAppSyncAuthorizerRouter } from '@lambda-event-router/appsync'

import { authoriseRequest } from './handlers/authorise.js'

const authRouter = createAppSyncAuthorizerRouter()

authRouter.route({ handler: authoriseRequest })
```

Both registration forms type the handler the same way, so the same annotated function goes through
`route()` and `defineAuthorizerRoute().handle()` equally.

A route carries no schema to derive a type from, so `AppSyncAuthorizerRequest` is the whole input
surface and the return type is the only one you write. [Annotated
handlers](/docs/handlers#annotated-handlers) has the worked version.

## Responses

Whatever a handler returns goes back to AppSync as the result of the invocation. `isAuthorized` is the
only field AppSync needs. The rest decide what the request may see and how long the answer is cached
for.

### Response helpers

`Authorized` and `Denied` build the result, so you set the fields you care about and leave the rest
off.

```ts
import { Authorized, Denied } from '@lambda-event-router/appsync'

return Authorized()
return Authorized({
  resolverContext: { userId: 'user-123', tenantId: 'acme' },
  deniedFields: ['User.email'],
  ttlOverride: 300,
})
return Denied()
return Denied({ ttlOverride: 0 })
```

| Helper | `isAuthorized` | Options |
| --- | --- | --- |
| `Authorized(options?)` | `true` | `resolverContext`, `deniedFields`, `ttlOverride` |
| `Denied(options?)` | `false` | `ttlOverride` |

Both options objects are optional, and so is every key inside them. A key you leave off is left off the
result rather than set to `undefined`.

**`Denied` takes no `deniedFields`.** AppSync rejects the whole request when `isAuthorized` is `false`,
so there is nothing left for the list to hide. Holding fields back is something you do to a caller you
are letting through, which [Denied fields](#denied-fields) covers.

### Denied fields

A field named in `deniedFields` comes back as `null` however the resolver behind it answers, so you can
let a caller into an operation with parts of the response held back.

```ts
return Authorized({ resolverContext: { userId: 'user-123' }, deniedFields: ['User.email'] })
```

Name a field as `TypeName.fieldName`. Where one function authorises several APIs and a short name could
mean a field on either, use the full ARN instead:
`arn:aws:appsync:eu-west-2:123456789012:apis/abc123/types/User/fields/email`.

### Resolver context

`resolverContext` is how an authorizer passes what it worked out to the resolvers behind it, where it
arrives as `$ctx.identity.resolverContext`. A tenant id or a plan put on there is one lookup the API
does not repeat.

```ts
return Authorized({ resolverContext: { userId: 'user-123', tenantId: 'acme', plan: 'pro' } })
```

**AppSync supports key-value pairs here and nothing nested.** The type is a `Record<string, unknown>`
and will happily take an object, so nothing pushes back at compile time. Flatten what you need before
you put it on there, and keep it under 5MB, which is the ceiling AppSync puts on the whole object.

### Caching

AppSync caches an authorizer result against the API id and the token, so the same caller sending the
same token can skip your function entirely. Caching is off until you turn it on, either on the API or
per response with `ttlOverride`.

| `ttlOverride` | What AppSync does |
| --- | --- |
| Left off | Uses the TTL set on the API |
| `0` | Does not cache the response |
| A number of seconds | Caches the response for that long |

**A cached decision outlives whatever it was based on.** A suspended account or a rotated key keeps
getting in until the entry expires, so pick a TTL you can live with and return `ttlOverride: 0` on the
answers that must not stick.

**A response of 1,048,576 bytes or more is never cached.** AppSync invokes the function on every
request above that size, so a large `resolverContext` costs you an invocation per query however the TTL
is set.

### Throwing

Throwing a response works the same as returning it, and it carries the same weight from any depth, so a
token check three calls below your handler can refuse a request without every function in between
passing a failure back up.

```ts
import { Denied } from '@lambda-event-router/appsync'

const user = await users.fromToken(authorizationToken)
if (!user) throw Denied()
```

**Only a response is caught.** The router checks a thrown value for a boolean `isAuthorized`, so a
thrown `Error` is not one. `isAppSyncAuthorizerResponse` is that check, exported so you can run it
yourself.

**Anything else thrown fails the invocation, and AppSync reads that as a refusal.** The router rethrows
it untouched, so Lambda records the error and the caller gets an `UnauthorizedException` all the same.
A refusal you mean is a `Denied()`, which leaves the error log for the failures you did not expect.

## Middleware

Router and route middleware are both typed `AppSyncAuthorizerMiddleware`, and the chain runs once per
authorisation.

```ts
import type { AppSyncAuthorizerMiddleware } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

export const withRequestContext: AppSyncAuthorizerMiddleware = async (request, next) => {
  logger.appendKeys({ apiId: request.apiId })

  return next(request)
}
```

```ts
const authRouter = createAppSyncAuthorizerRouter({ middleware: [withRequestContext] })

authRouter.route({
  middleware: [withAudit],
  handler: authoriseRequest,
})
```

Router middleware runs before route middleware, and both run before the handler. A response thrown from
inside the chain, with `Denied()` or `Authorized()`, is caught and returned the same way a throw from
the handler is. See [middleware](/docs/middleware) for the execution order and the three levels it
attaches at.

## Types

All exported from `@lambda-event-router/appsync`.

| Type | Description |
| --- | --- |
| `AppSyncAuthorizerRequest` | The handler argument |
| `AppSyncAuthorizerResponse` | The handler return type, `AppSyncAuthorizerResult<Record<string, unknown>>` |
| `AppSyncAuthorizerMiddleware` | Router and route middleware |
| `AppSyncAuthorizerRouteDefinition` | A route, which is the `handler` key and optional `middleware` |
| `AppSyncAuthorizerRouterOptions` | Options for `createAppSyncAuthorizerRouter` |
| `AuthorizedOptions` | The options `Authorized` takes |
| `DeniedOptions` | The options `Denied` takes |

`AppSyncAuthorizerResponse` is this package's alias of `aws-lambda`'s
`AppSyncAuthorizerResult<Record<string, unknown>>`, which is what `Authorized` and `Denied` build.
`AppSyncAuthorizerEvent` and `Context` on the request also come from `aws-lambda`.

None of them take a generic parameter. A route carries no filters and no schema, so there is nothing
for a type to pass through and every handler on this router is given the same request.

The `AppSyncAuthorizerRouter` class and the `createAppSyncAuthorizerRouter` and `defineAuthorizerRoute`
functions come from the same place, along with `Authorized`, `Denied` and
`isAppSyncAuthorizerResponse`.

## Code example

One authorizer for a tenanted API: a Bearer token is verified, a suspended account is turned away
without being cached, and a member gets in with the personal fields on `User` blanked out.

Open a file: [index.ts](#appsync-authorizer-example:index.ts) | [authorizer router](#appsync-authorizer-example:authorizer.ts) | [handler](#appsync-authorizer-example:handlers/authorise.ts) | [lookups](#appsync-authorizer-example:accounts.ts)

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
    code: `import { createAppSyncAuthorizerRouter } from '@lambda-event-router/appsync'

import { authoriseRequest } from './handlers/authorise.js'

export const authRouter = createAppSyncAuthorizerRouter()

authRouter.route({ handler: authoriseRequest })`,
  },
  {
    path: 'handlers/authorise.ts',
    code: `import type { AppSyncAuthorizerResult } from 'aws-lambda'
import type { AppSyncAuthorizerRequest } from '@lambda-event-router/appsync'
import { Authorized, Denied } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

import { users } from '../accounts.js'

const ADMIN_ONLY_FIELDS = ['User.email', 'User.phoneNumber']

export async function authoriseRequest(
  request: AppSyncAuthorizerRequest,
): Promise<AppSyncAuthorizerResult<Record<string, unknown>>> {
  const { authorizationToken, operationName, requestId } = request

  const [scheme, token] = authorizationToken.split(' ')
  if (scheme !== 'Bearer' || !token) {
    logger.warn(\`Rejected a \${scheme} credential on request \${requestId}\`)
    return Denied()
  }

  const user = await users.fromToken(token)
  if (!user) {
    logger.warn(\`Rejected an unknown token running \${operationName}\`)
    return Denied()
  }

  // Nothing cached for a suspended account, so lifting the suspension takes effect at once
  if (user.status === 'suspended') {
    return Denied({ ttlOverride: 0 })
  }

  const resolverContext = { userId: user.id, tenantId: user.tenantId, role: user.role }

  if (user.role === 'admin') {
    return Authorized({ resolverContext, ttlOverride: 300 })
  }

  // Everyone else gets in with the personal fields blanked out
  return Authorized({ resolverContext, deniedFields: ADMIN_ONLY_FIELDS, ttlOverride: 300 })
}`,
  },
  {
    path: 'accounts.ts',
    code: `interface User {
  id: string
  tenantId: string
  role: 'admin' | 'member'
  status: 'active' | 'suspended'
}

export const users = {
  async fromToken(token: string): Promise<User | undefined> {
    // Verify the JWT and load whoever it belongs to
    return { id: 'user-123', tenantId: 'acme', role: 'member', status: 'active' }
  },
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="appsync-authorizer-example" default-file="handlers/authorise.ts" line-numbers collapse-toggle fixed-height />

One route takes every request, so the three answers are decisions inside `authoriseRequest` rather than
separate registrations. A subscription's connect request runs the same path, and its
`DeepDish:Connect` operation name only reaches the log line.

The member gets the same `resolverContext` as an admin and loses the two fields on `User` that only an
admin may read, so one route covers both without the resolvers behind it checking a role.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

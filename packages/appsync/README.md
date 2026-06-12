# @lambda-event-router/appsync

AppSync routing for resolvers, authorizers and Event API handlers.

**Supported AWS Services:** `AWS AppSync`

**Available Routers:** `AppSyncRouter` | `AppSyncAuthorizerRouter` | `AppSyncEventsRouter`

(See [Routers](#routers) for more details)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/appsync
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


## Quick Start

This example is for the AppSyncRouter. See [Usage](#usage) for examples of the other routers

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { appSyncRouter } from './appsync'

const lambdaRouter = new LambdaRouter({
  routers: [appSyncRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// appsync.ts
import { createAppSyncRouter, defineRoute } from '@lambda-event-router/appsync'

export const appSyncRouter = createAppSyncRouter()

// An inline handler lets TypeScript infer the request from the route
const getItem = defineRoute({
  filters: {
    parentTypeName: 'Query',
    fieldName: 'getItem',
  },
}).handle(async ({ arguments: args, identity }) => {
  return { id: args.id, name: 'Example Item' }
})
appSyncRouter.route(getItem)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// appsync.ts
import type { AppSyncResolverRequest } from '@lambda-event-router/appsync'
import { createAppSyncRouter } from '@lambda-event-router/appsync'

export const appSyncRouter = createAppSyncRouter()

// Separate handler to define routes and handlers in different places
appSyncRouter.route({
  filters: {
    parentTypeName: 'Query',
    fieldName: 'getItem',
  },
  handler: getItem,
})

// A separate handler has to name its request type, since there is no route to infer it from
export async function getItem({ arguments: args }: AppSyncResolverRequest) {
  return { id: args.id, name: 'Example Item' }
}
```


## Routers

| AWS Service | Event Source | Router | Usage
|---|---|---|---|
| AppSync | Resolver | `AppSyncRouter` | [AppSyncRouter](#appsyncrouter) |
| AppSync | Authorizer | `AppSyncAuthorizerRouter` | [AppSyncAuthorizerRouter](#appsyncauthorizerrouter) |
| AppSync | Events | `AppSyncEventsRouter` | [AppSyncEventsRouter](#appsynceventsrouter) |


## Usage

### AppSyncRouter

#### Inline handlers

```ts
import { createAppSyncRouter, defineRoute } from '@lambda-event-router/appsync'

const appSyncRouter = createAppSyncRouter()

const getItem = defineRoute({
  filters: {
    parentTypeName: 'Query',
    fieldName: 'getItem',
  },
}).handle(async ({ arguments: args, identity }) => {
  return { id: args.id, name: 'Example Item' }
})

appSyncRouter.route(getItem)
```

#### Separate handlers

```ts
import type { AppSyncResolverRequest } from '@lambda-event-router/appsync'
import { createAppSyncRouter } from '@lambda-event-router/appsync'

const appSyncRouter = createAppSyncRouter()

appSyncRouter.route({
  filters: {
    parentTypeName: 'Mutation',
    fieldName: 'createItem',
  },
  handler: createItem,
})

async function createItem({ arguments: args }: AppSyncResolverRequest) {
  return { id: args.id, name: args.name }
}
```

#### Convenience methods

`query()`, `mutation()` and `subscription()` set `parentTypeName` and take the field name at the top
level. `custom` is the only filter key they take.

```ts
appSyncRouter
  .query({ fieldName: 'getItem', handler: getItem })
  .mutation({ fieldName: 'createItem', handler: createItem })
  .subscription({ fieldName: 'onItemCreated', handler: onItemCreated })
```

#### Schema validation and middleware

`argumentsSchema` validates the field's arguments before the handler runs, and `middleware` runs per
invocation at either level.

```ts
const appSyncRouter = createAppSyncRouter({ middleware: [withRequestContext] })

appSyncRouter.mutation({
  fieldName: 'createItem',
  argumentsSchema: CreateItemSchema,
  middleware: [withItemContext],
  handler: createItem,
})
```

#### Filters

```ts
defineRoute({
  filters: {
    parentTypeName: 'Mutation',
    fieldName: 'createItem',
    custom: ({ event }) => event.request.headers['x-tenant'] === 'acme',
  },
})
```

### AppSyncAuthorizerRouter

#### Inline handlers

```ts
import { createAppSyncAuthorizerRouter, defineAuthorizerRoute, Authorized, Denied } from '@lambda-event-router/appsync'

const authRouter = createAppSyncAuthorizerRouter()

authRouter.route(
  defineAuthorizerRoute().handle(async ({ authorizationToken }) => {
    if (isValid(authorizationToken)) return Authorized()
    return Denied()
  })
)
```

#### Separate handlers

```ts
import type { AppSyncAuthorizerRequest } from '@lambda-event-router/appsync'
import { createAppSyncAuthorizerRouter, Authorized, Denied } from '@lambda-event-router/appsync'

const authRouter = createAppSyncAuthorizerRouter()

authRouter.route({
  handler: validateToken,
})

async function validateToken({ authorizationToken }: AppSyncAuthorizerRequest) {
  if (isValid(authorizationToken)) return Authorized()
  return Denied()
}
```

### AppSyncEventsRouter

#### Inline handlers

```ts
import { createAppSyncEventsRouter, defineEventsRoute } from '@lambda-event-router/appsync'

const eventsRouter = createAppSyncEventsRouter()

eventsRouter.route(
  defineEventsRoute({
    filters: { operation: 'PUBLISH', channelPath: '/default/*' },
  }).handle(async ({ events }) => {
    return { events }
  })
)
```

`channelPath` matches the channel path, so it takes `/default/*`. To match by the namespace name
instead, use `channelNamespace: 'default'`.

#### Separate handlers

```ts
import type { AppSyncEventsRequest } from '@lambda-event-router/appsync'
import { createAppSyncEventsRouter } from '@lambda-event-router/appsync'

const eventsRouter = createAppSyncEventsRouter()

eventsRouter.route({
  filters: { operation: 'SUBSCRIBE', channelPath: '/default/*' },
  handler: handleSubscribe,
})

// Returning allows the subscription, throwing refuses it
async function handleSubscribe({ channelPath, identity }: AppSyncEventsRequest) {
  if (!identity) throw new Error(`Nobody may subscribe to ${channelPath} anonymously`)
}
```

#### Convenience methods

`publish()` and `subscribe()` set the `operation` filter and take the channel path at the top level.

```ts
eventsRouter
  .publish({ channelPath: '/default/*', handler: handlePublish })
  .subscribe({ channelPath: '/default/*', handler: handleSubscribe })
```

## Examples

See the [examples/appsync](../../examples/appsync) directory for complete working examples.

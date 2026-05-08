# @lambda-event-router/appsync

AppSync routing for resolvers, authorizers, and event handlers.

**Supported AWS Services:** `AWS AppSync`

**Available Routers:** `AppSyncRouter` | `AppSyncAuthorizerRouter` | `AppSyncEventsRouter`

(See [Routers](#routers) for more details)

## Install

```bash
npm install @lambda-event-router/appsync
```


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

const appSyncRouter = createAppSyncRouter()

// Inline functions allows Typescript to automatic infer types
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
import { createAppSyncRouter } from '@lambda-event-router/appsync'

const appSyncRouter = createAppSyncRouter()

// Separate handler to define routes and handlers in different places
appSyncRouter.route({
  filters: {
    parentTypeName: 'Query',
    fieldName: 'getItem',
  },
  handler: getItem,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function getItem({ arguments: args, identity }) {
  return { id: args.id, name: 'Example Item' }
}
```


## Routers

| AWS Service | Event Source | Router | Usage
|---|---|---|---|
| AppSync | Resolver | `AppSyncRouter` | <Usage link here> |
| AppSync | Authorizer | `AppSyncAuthorizerRouter` | <Usage link here> |
| AppSync | Events | `AppSyncEventsRouter` | <Usage link here> |


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
import { createAppSyncRouter } from '@lambda-event-router/appsync'

const appSyncRouter = createAppSyncRouter()

appSyncRouter.route({
  filters: {
    parentTypeName: 'Mutation',
    fieldName: 'createItem',
  },
  handler: createItem,
})

async function createItem({ arguments: args, identity }) {
  return { id: args.id, name: args.name }
}
```

#### Filters

```ts
defineRoute({
  filters: {
    parentTypeName: 'Mutation',
    fieldName: 'createItem',
    customFilter: ({ event }) => event.request.headers['x-tenant'] === 'acme',
  },
})
```

### AppSyncAuthorizerRouter

#### Inline handlers

```ts
import { createAppSyncAuthorizerRouter, defineAuthorizerRoute, Authorized, Denied } from '@lambda-event-router/appsync'

const authRouter = createAppSyncAuthorizerRouter()

authRouter.route(
  defineAuthorizerRoute({}).handle(async ({ authorizationToken }) => {
    if (isValid(authorizationToken)) return Authorized()
    return Denied()
  })
)
```

#### Separate handlers

```ts
import { createAppSyncAuthorizerRouter, Authorized, Denied } from '@lambda-event-router/appsync'

const authRouter = createAppSyncAuthorizerRouter()

authRouter.route({
  handler: validateToken,
})

async function validateToken({ authorizationToken }) {
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
    filters: { operation: 'SUBSCRIBE' },
  }).handle(async ({ event }) => {
    return event
  })
)
```

#### Separate handlers

```ts
import { createAppSyncEventsRouter } from '@lambda-event-router/appsync'

const eventsRouter = createAppSyncEventsRouter()

eventsRouter.route({
  filters: { operation: 'SUBSCRIBE' },
  handler: handleSubscribe,
})

async function handleSubscribe({ event }) {
  return event
}
```

## Examples

See the [examples/appsync](../../examples/appsync) directory for complete working examples.

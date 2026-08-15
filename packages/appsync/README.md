# @lambda-event-router/appsync

Routes AppSync resolver calls to handlers by GraphQL type and field. The package also has routers for AppSync authorizers and the Events API.

**Supported AWS Services:** `AWS AppSync`

**Available Routers:** `AppSyncRouter` | `AppSyncAuthorizerRouter` | `AppSyncEventsRouter` | `AppSyncEventsAuthorizerRouter`

**Docs:** [AppSyncRouter](https://pyepye.github.io/lambda-event-router/routers/AppSyncRouter) | [AppSyncAuthorizerRouter](https://pyepye.github.io/lambda-event-router/routers/AppSyncAuthorizerRouter) | [AppSyncEventsRouter](https://pyepye.github.io/lambda-event-router/routers/AppSyncEventsRouter) | [AppSyncEventsAuthorizerRouter](https://pyepye.github.io/lambda-event-router/routers/AppSyncEventsAuthorizerRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/appsync
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { appSyncRouter } from './appsync'
import { authorizerRouter } from './authorizer'
import { eventsRouter } from './events'
import { eventsAuthorizerRouter } from './eventsAuthorizer'

const lambdaRouter = new LambdaRouter({
  routers: [appSyncRouter, authorizerRouter, eventsRouter, eventsAuthorizerRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// appsync.ts
import { createAppSyncRouter, defineRoute } from '@lambda-event-router/appsync'

export const appSyncRouter = createAppSyncRouter()

const getOrder = defineRoute({
  filters: {
    parentTypeName: 'Query',
    fieldName: 'getOrder',
  },
}).handle(async ({ arguments: args }) => {
  console.log(`Getting order ${args.id}`)
  return { id: args.id, status: 'SHIPPED' }
})

appSyncRouter.route(getOrder)
```

```ts
// authorizer.ts
import {
  Authorized,
  createAppSyncAuthorizerRouter,
  defineAuthorizerRoute,
  Denied,
} from '@lambda-event-router/appsync'

export const authorizerRouter = createAppSyncAuthorizerRouter()

const authoriseGetOrder = defineAuthorizerRoute({
  filters: {
    apiId: 'abc123',
    operationName: 'GetOrder',
  },
}).handle(async ({ authorizationToken, requestId }) => {
  console.log(`Authorising request ${requestId}`)
  return authorizationToken === process.env.API_TOKEN ? Authorized() : Denied()
})

authorizerRouter.route(authoriseGetOrder)
```

```ts
// events.ts
import { createAppSyncEventsRouter, defineEventsRoute } from '@lambda-event-router/appsync'

export const eventsRouter = createAppSyncEventsRouter()

const publishOrder = defineEventsRoute({
  filters: {
    operation: 'PUBLISH',
    channelPath: '/orders/*',
    channelNamespace: 'orders',
  },
}).handle(async ({ channelPath, events }) => {
  console.log(`Publishing ${events.length} events to ${channelPath}`)
  return { events }
})

eventsRouter.route(publishOrder)
```

```ts
// eventsAuthorizer.ts
import {
  createAppSyncEventsAuthorizerRouter,
  defineEventsAuthorizerRoute,
  EventsAuthorized,
  EventsDenied,
} from '@lambda-event-router/appsync'

export const eventsAuthorizerRouter = createAppSyncEventsAuthorizerRouter()

const authoriseOrderPublish = defineEventsAuthorizerRoute({
  filters: {
    operation: 'EVENT_PUBLISH',
    channelPath: '/orders/*',
    channelNamespace: 'orders',
  },
}).handle(async ({ authorizationToken, channelPath }) => {
  console.log(`Authorising a publish to ${channelPath}`)
  return authorizationToken === process.env.API_TOKEN ? EventsAuthorized() : EventsDenied()
})

eventsAuthorizerRouter.route(authoriseOrderPublish)
```

Each handler's types come from its route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/docs/handlers#annotated-handlers).

## Documentation

- [AppSyncRouter](https://pyepye.github.io/lambda-event-router/routers/AppSyncRouter) covers every filter, schema validation, nested field resolvers
  and batched resolvers.
- [AppSyncAuthorizerRouter](https://pyepye.github.io/lambda-event-router/routers/AppSyncAuthorizerRouter) covers every filter, responses
  and middleware.
- [AppSyncEventsRouter](https://pyepye.github.io/lambda-event-router/routers/AppSyncEventsRouter) covers every filter, responses
  and middleware.
- [AppSyncEventsAuthorizerRouter](https://pyepye.github.io/lambda-event-router/routers/AppSyncEventsAuthorizerRouter) covers every filter, responses
  and middleware.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/appsync](../../service-examples/appsync) for a deployable app.

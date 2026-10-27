# @latcher/appsync

Routes AppSync resolver calls to handlers by GraphQL type and field. The package also has matchers for AppSync authorizers and the Events API.

**Supported AWS Services:** `AWS AppSync`

**Available Matchers:** `AppSyncMatcher` | `AppSyncAuthorizerMatcher` | `AppSyncEventsMatcher` | `AppSyncEventsAuthorizerMatcher`

**Docs:** [AppSyncMatcher](https://pyepye.github.io/latcher/matchers/AppSyncMatcher) | [AppSyncAuthorizerMatcher](https://pyepye.github.io/latcher/matchers/AppSyncAuthorizerMatcher) | [AppSyncEventsMatcher](https://pyepye.github.io/latcher/matchers/AppSyncEventsMatcher) | [AppSyncEventsAuthorizerMatcher](https://pyepye.github.io/latcher/matchers/AppSyncEventsAuthorizerMatcher)

## Install

```bash
npm install @latcher/base @latcher/appsync
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { appSyncMatcher } from './appsync'
import { authorizerMatcher } from './authorizer'
import { eventsMatcher } from './events'
import { eventsAuthorizerMatcher } from './eventsAuthorizer'

const latcher = new Latcher({
  matchers: [appSyncMatcher, authorizerMatcher, eventsMatcher, eventsAuthorizerMatcher],
})

export const handler = latcher.handler()
```

```ts
// appsync.ts
import { createAppSyncMatcher, defineRoute } from '@latcher/appsync'

export const appSyncMatcher = createAppSyncMatcher()

const getOrder = defineRoute({
  filters: {
    parentTypeName: 'Query',
    fieldName: 'getOrder',
  },
}).handle(async ({ arguments: args }) => {
  console.log(`Getting order ${args.id}`)
  return { id: args.id, status: 'SHIPPED' }
})

appSyncMatcher.route(getOrder)
```

```ts
// authorizer.ts
import {
  Authorized,
  createAppSyncAuthorizerMatcher,
  defineAuthorizerRoute,
  Denied,
} from '@latcher/appsync'

export const authorizerMatcher = createAppSyncAuthorizerMatcher()

const authoriseGetOrder = defineAuthorizerRoute({
  filters: {
    apiId: 'abc123',
    operationName: 'GetOrder',
  },
}).handle(async ({ authorizationToken, requestId }) => {
  console.log(`Authorising request ${requestId}`)
  return authorizationToken === process.env.API_TOKEN ? Authorized() : Denied()
})

authorizerMatcher.route(authoriseGetOrder)
```

```ts
// events.ts
import { createAppSyncEventsMatcher, defineEventsRoute } from '@latcher/appsync'

export const eventsMatcher = createAppSyncEventsMatcher()

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

eventsMatcher.route(publishOrder)
```

```ts
// eventsAuthorizer.ts
import {
  createAppSyncEventsAuthorizerMatcher,
  defineEventsAuthorizerRoute,
  EventsAuthorized,
  EventsDenied,
} from '@latcher/appsync'

export const eventsAuthorizerMatcher = createAppSyncEventsAuthorizerMatcher()

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

eventsAuthorizerMatcher.route(authoriseOrderPublish)
```

Each handler's types come from its route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/docs/handlers#annotated-handlers).

## Documentation

- [AppSyncMatcher](https://pyepye.github.io/latcher/matchers/AppSyncMatcher) covers every filter, schema validation, nested field resolvers
  and batched resolvers.
- [AppSyncAuthorizerMatcher](https://pyepye.github.io/latcher/matchers/AppSyncAuthorizerMatcher) covers every filter, responses
  and middleware.
- [AppSyncEventsMatcher](https://pyepye.github.io/latcher/matchers/AppSyncEventsMatcher) covers every filter, responses
  and middleware.
- [AppSyncEventsAuthorizerMatcher](https://pyepye.github.io/latcher/matchers/AppSyncEventsAuthorizerMatcher) covers every filter, responses
  and middleware.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/appsync](../../service-examples/appsync) for a deployable app.

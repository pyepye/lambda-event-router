# AppSyncEventsRouter

`AppSyncEventsRouter` routes AWS AppSync Events requests to handlers, one publish or subscribe per
invocation.

An Event API is a WebSocket broker: clients subscribe to a channel and publish to it, and AppSync fans
each message out to whoever is listening. Attach a Lambda to a channel namespace and it gets asked
about both, so your handler either transforms the messages going through or decides who may listen.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/appsync
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createAppSyncEventsRouter } from '@lambda-event-router/appsync'
import { withRequestContext } from './middleware/withRequestContext'

const eventsRouter = createAppSyncEventsRouter({
  middleware: [withRequestContext],  // Optional
})
```

`middleware` is the only option and it can be left out. `createAppSyncEventsRouter()` on its own gives
you a router with no shared middleware, see [Middleware](#middleware).

## Register routes

```ts
eventsRouter.route({
  filters: {
    operation: 'PUBLISH',
    channelPath: '/orders/*',
  },
  middleware: [withOrderContext],   // Optional
  handler: onOrderPublish,
})
```

`filters` and `handler` are required and `middleware` is optional. An empty `filters: {}` gives you a
route that takes anything reaching it.

A route has no schema key, so validate the payloads you were sent inside the handler.

`route()` returns the router, so you can chain registrations.

```ts
eventsRouter.route(orderPublishRoute).route(orderSubscribeRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A request that matches no route throws `No route matched for PUBLISH on channel /orders/eu`.**
AppSync reads a failed invocation as a refusal, so the publish fails or the subscription is turned
away. Cover both operations on every namespace you attach the Lambda to, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

### Convenience methods

`publish()` and `subscribe()` fill in the `operation` filter and take the channel path at the top
level rather than inside `filters`.

```ts
// Both of these register the same route
eventsRouter.publish({
  channelPath: '/orders/*',
  handler: onOrderPublish,
})

eventsRouter.route({
  filters: { operation: 'PUBLISH', channelPath: '/orders/*' },
  handler: onOrderPublish,
})
```

| Method | Sets |
| --- | --- |
| `publish()` | `operation: 'PUBLISH'` |
| `subscribe()` | `operation: 'SUBSCRIBE'` |

Both take `handler` exactly as `route()` does. What they drop is the rest of the filters:
`custom` is the only key left, and `channelPath` moves out to the top level where it is
required rather than optional. To match by namespace name instead, use the full `route()` form with
`channelNamespace`. See [convenience methods](/docs/routing#convenience-methods) for how the
other routers use them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the requests you want and leave the rest off.

```ts
import { isObject } from '@lambda-event-router/base'

eventsRouter.route({
  filters: {
    operation: ['PUBLISH', 'SUBSCRIBE'],
    channelPath: '/orders/*', // Or a pattern: /^\/orders\//
    channelNamespace: 'orders',
    custom: ({ event }) => {
      // Only a custom reaches the payloads
      const payload = event.events?.[0]?.payload

      return isObject(payload) && payload.type === 'refund'
    },
  },
  handler: onRefund,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `operation` | `AppSyncEventsOperation \| AppSyncEventsOperation[]` | Matches `PUBLISH` or `SUBSCRIBE`. Compared exactly, so patterns and wildcards do nothing here |
| `channelPath` | `FilterStringMatcher` | Matches the channel path, so `/orders/eu/refunds` |
| `channelNamespace` | `FilterStringMatcher` | Matches the namespace name, so `orders`, whatever the channel path underneath it looks like |
| `custom` | `(input: AppSyncEventsFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Given `operation`, `channelNamespace`, `channelPath` and the raw `event` |

**`channelPath` and `channelNamespace` match different things.** A namespace called `orders` publishes
on `/orders/...`, so `channelPath: '/orders/*'` picks it out by the path and `channelNamespace: 'orders'`
picks it out by the name. Reach for the path when you want one channel or a sub-tree, and the name when
you want the whole namespace however its channels are laid out.

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**A `custom` here may be async.** The router awaits its result, so a `Promise<boolean>` resolves
before the route is decided and the route matches only when the filter resolves truthy. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return what AppSync should do with the request.

```ts
import type { AppSyncEventsRequest } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

export async function onOrderPublish(request: AppSyncEventsRequest): Promise<unknown> {
  const { channelPath, events } = request
  logger.info(`Publishing ${events.length} events to ${channelPath}`)

  return { events }
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `channelPath` | `string` | The channel path the request is for, such as `/orders/eu/refunds` |
| `channelNamespace` | `string` | The name of the namespace that channel belongs to |
| `operation` | `AppSyncEventsOperation` | `PUBLISH` or `SUBSCRIBE` |
| `identity` | `AppSyncEventsIdentity \| null \| undefined` | Who the caller is. The shape follows the API's authorisation mode, and it is `null` where the API does not identify anyone |
| `events` | `Record<string, unknown>[]` | The published events, and empty on a `SUBSCRIBE` |
| `info` | `{ channel, channelNamespace, operation }` | The same three values as AppSync sends them, with `channel` holding its `path` and `segments` |
| `request` | `{ headers, domainName }` | The headers the client sent, and the custom domain the request arrived on |
| `stash` | `Record<string, unknown>` | State shared across the functions of a pipeline |
| `prev` | `{ result: Record<string, unknown> } \| null` | What the function before yours returned in a pipeline |
| `event` | `AppSyncEventsEvent` | The untouched event from AWS |
| `context` | `Context` | The Lambda context |

`Context` comes from `aws-lambda`. Everything else here is declared by this package, since AppSync
Events has no `aws-lambda` type of its own.

**An event is a `Record<string, unknown>`.** AppSync sends each one as an `id` and a `payload`, and the
router passes them through without typing either, so narrow a payload with `isObject` from
`@lambda-event-router/base` before reading into it.

### Response type

A route asks only for a `Promise<unknown>`, so the return type is yours to name. What you return goes
back to AppSync untouched, which [Responses](#responses) covers.

### Inferred handlers

`defineEventsRoute()` hands your handler the request without you naming its type, so there is nothing
to look up and nothing to keep in sync.

```ts
import { defineEventsRoute } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

export const orderPublishRoute = defineEventsRoute({
  filters: { operation: 'PUBLISH', channelPath: '/orders/*' },
}).handle(async ({ channelPath, events }) => {
  logger.info(`Publishing ${events.length} events to ${channelPath}`)

  return { events }
})

eventsRouter.route(orderPublishRoute)
```

**The builder is `defineEventsRoute`, not `defineRoute`.** The package holds three routers and
`defineRoute` belongs to [`AppSyncRouter`](/routers/AppSyncRouter), so this one carries its own name.
`filters` is optional on it, unlike on `route()`.

A route carries no schema, so both forms hand the handler the same `AppSyncEventsRequest`. Inference
still earns its keep in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`AppSyncEventsRequest`](#types).

```ts
// handlers/orders.ts
import type { AppSyncEventsRequest } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

export async function onOrderPublish({ channelPath, events }: AppSyncEventsRequest): Promise<unknown> {
  logger.info(`Publishing ${events.length} events to ${channelPath}`)

  return { events }
}
```

```ts
// events.ts
import { createAppSyncEventsRouter } from '@lambda-event-router/appsync'

import { onOrderPublish } from './handlers/orders.js'

const eventsRouter = createAppSyncEventsRouter()

eventsRouter.publish({
  channelPath: '/orders/*',
  handler: onOrderPublish,
})
```

`AppSyncEventsRequest` takes no generic parameter, so there is one request type for every route and
nothing to derive from a schema. What varies is the payloads you were sent, and those are yours to
narrow. [Annotated handlers](/docs/handlers#annotated-handlers) has the worked version.

## Responses

What a handler returns is sent to AppSync untouched, and what AppSync wants back depends on the
operation.

**A `PUBLISH` handler returns the events it wants delivered**, as `{ events }` with each entry carrying
the `id` it arrived with. Subscribers get the payloads you hand back rather than the ones the client
sent, so this is where a message gets transformed, dropped or rejected.

```ts
import type { AppSyncEventsRequest } from '@lambda-event-router/appsync'
import { isObject } from '@lambda-event-router/base'

export async function onOrderPublish({ events }: AppSyncEventsRequest): Promise<unknown> {
  const stamped = events.map((event) => {
    if (!isObject(event.payload)) return { id: event.id, error: 'A payload has to be an object' }

    return { id: event.id, payload: { ...event.payload, receivedAt: new Date().toISOString() } }
  })

  return { events: stamped }
}
```

| Return | What AppSync does with it |
| --- | --- |
| `{ events }` carrying every event | Delivers all of them to the channel's subscribers |
| `{ events }` with one left out | Delivers the rest and never sends the one you left out |
| `{ events: [] }` | Drops the whole batch |
| An entry of `{ id, error }` | Fails that one event and delivers the others |
| `{ error }` at the top level | Fails the whole publish |
| A throw | Fails the whole publish |

**A `SUBSCRIBE` handler decides whether the client may listen.** Returning allows the subscription and
throwing refuses it, and `events` is empty either way since nothing has been published yet.

```ts
export async function onOrderSubscribe({ channelPath, identity }: AppSyncEventsRequest): Promise<void> {
  const groups = identity?.groups ?? []
  if (!groups.includes('staff')) {
    throw new Error(`${identity?.username} may not subscribe to ${channelPath}`)
  }
}
```

There is no response helper for a refusal, so the message you throw with is what lands in the Lambda
error log rather than anything the client is shown.

## Middleware

Router and route middleware are both typed `AppSyncEventsMiddleware`, and the chain runs once per
request.

```ts
import type { AppSyncEventsMiddleware } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

export const withRequestContext: AppSyncEventsMiddleware = async (request, next) => {
  logger.appendKeys({ channelPath: request.channelPath })

  return next(request)
}
```

```ts
const eventsRouter = createAppSyncEventsRouter({ middleware: [withRequestContext] })

eventsRouter.route({
  filters: { operation: 'PUBLISH', channelPath: '/orders/*' },
  middleware: [withOrderContext],
  handler: onOrderPublish,
})
```

Router middleware runs before route middleware, and both run before the handler. A middleware that does
not call `next` short-circuits the chain, so the handler never runs. See [middleware](/docs/middleware)
for the execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/appsync`.

| Type | Description |
| --- | --- |
| `AppSyncEventsRequest` | The handler argument |
| `AppSyncEventsEvent` | The event AppSync sends, which is also `request.event` |
| `AppSyncEventsIdentity` | The caller, on `request.identity` |
| `AppSyncEventsOperation` | `'PUBLISH' \| 'SUBSCRIBE'` |
| `AppSyncEventsFilters` | The `filters` object |
| `AppSyncEventsFilterInput` | What `custom` receives |
| `AppSyncEventsMiddleware` | Router and route middleware |
| `AppSyncEventsOperationFilters` | The `filters` object on `publish()` and `subscribe()`, which is `custom` on its own |
| `AppSyncEventsRouteDefinition` | A full route passed to `route()` |
| `AppSyncEventsRouterOptions` | Options for `createAppSyncEventsRouter` |
| `AppSyncEventsChannelInput` | A route passed to `publish()` or `subscribe()` |
| `AppSyncPublishInput`, `AppSyncSubscribeInput` | Aliases of `AppSyncEventsChannelInput`, one per method |

The `AppSyncEventsRouter` class and the `createAppSyncEventsRouter` and `defineEventsRoute` functions
come from the same place.

No type here takes a generic parameter. A route carries no schema, so there is nothing for one to pass
through and every handler on this router is given the same request.

## Code example

An Event API for an orders app. Publishes on `/orders/*` are stamped and their payloads checked, only
staff may subscribe to them, and a `/presence/*` namespace alongside drops the heartbeats that arrive
too late to be worth delivering.

Open a file: [index.ts](#appsync-events-example:index.ts) | [events router](#appsync-events-example:events.ts) | [orders](#appsync-events-example:handlers/orders.ts) | [presence](#appsync-events-example:handlers/presence.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { eventsRouter } from './events.js'

const lambdaRouter = new LambdaRouter({
  routers: [eventsRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'events.ts',
    code: `import { createAppSyncEventsRouter } from '@lambda-event-router/appsync'

import { onOrderPublish, onOrderSubscribe } from './handlers/orders.js'
import { onPresencePublish, onPresenceSubscribe } from './handlers/presence.js'

export const eventsRouter = createAppSyncEventsRouter()

eventsRouter
  .publish({ channelPath: '/orders/*', handler: onOrderPublish })
  .subscribe({ channelPath: '/orders/*', handler: onOrderSubscribe })
  .publish({ channelPath: '/presence/*', handler: onPresencePublish })
  .subscribe({ channelPath: '/presence/*', handler: onPresenceSubscribe })`,
  },
  {
    path: 'handlers/orders.ts',
    code: `import type { AppSyncEventsRequest } from '@lambda-event-router/appsync'
import { isObject, logger } from '@lambda-event-router/base'

export async function onOrderPublish({ channelPath, events }: AppSyncEventsRequest): Promise<unknown> {
  logger.info(\`Publishing \${events.length} events to \${channelPath}\`)

  const stamped = events.map((event) => {
    // A payload the rest of the app cannot read fails on its own rather than with the batch
    if (!isObject(event.payload)) {
      return { id: event.id, error: 'A payload has to be an object' }
    }

    return { id: event.id, payload: { ...event.payload, receivedAt: new Date().toISOString() } }
  })

  return { events: stamped }
}

export async function onOrderSubscribe({ channelPath, identity }: AppSyncEventsRequest): Promise<void> {
  const groups = identity?.groups ?? []

  if (!groups.includes('staff')) {
    // Throwing is how a subscription gets refused
    throw new Error(\`\${identity?.username} may not subscribe to \${channelPath}\`)
  }

  logger.info(\`\${identity?.username} subscribed to \${channelPath}\`)
}`,
  },
  {
    path: 'handlers/presence.ts',
    code: `import type { AppSyncEventsRequest } from '@lambda-event-router/appsync'
import { isObject, logger } from '@lambda-event-router/base'

const STALE_AFTER_MS = 60_000

export async function onPresencePublish({ channelPath, events }: AppSyncEventsRequest): Promise<unknown> {
  const fresh = events.filter((event) => {
    if (!isObject(event.payload) || typeof event.payload.sentAt !== 'number') return false

    return Date.now() - event.payload.sentAt < STALE_AFTER_MS
  })

  // Anything left out of the returned array is never delivered
  logger.info(\`Delivering \${fresh.length} of \${events.length} heartbeats on \${channelPath}\`)

  return { events: fresh }
}

export async function onPresenceSubscribe({ channelPath }: AppSyncEventsRequest): Promise<void> {
  // Presence is open to anyone the API let in, so there is nothing to check
  logger.info(\`A client subscribed to \${channelPath}\`)
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="appsync-events-example" default-file="events.ts" line-numbers collapse-toggle fixed-height />

Each route pins both an operation and a channel pattern, and the two namespaces do not overlap, so no
request can match two routes and the order they are registered in makes no difference. Between them the
four routes cover every request the two namespaces can send, which is what keeps a stray publish from
failing on a route that was never registered.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

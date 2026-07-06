# AppSyncEventsAuthorizerRouter

`AppSyncEventsAuthorizerRouter` routes AWS AppSync Event API Lambda authorizer events to a handler,
one authorisation request per invocation.

AppSync calls your function before a client connects, before every publish and before every
subscribe. It hands over the token the client sent, and the channel where there is one, and waits for
a yes or no.

This is a different router from [AppSyncAuthorizerRouter](/routers/AppSyncAuthorizerRouter), which
guards a GraphQL API. The event, the response and the things worth filtering on are all different, so
one function can hold both and `LambdaRouter` picks between them on shape.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/appsync
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createAppSyncEventsAuthorizerRouter } from '@lambda-event-router/appsync'

import { logChannelAuthorisation } from './middleware/logChannelAuthorisation'

const eventsAuthorizerRouter = createAppSyncEventsAuthorizerRouter({
  middleware: [logChannelAuthorisation],  // Optional
})
```

`middleware` is the only option, so `createAppSyncEventsAuthorizerRouter()` on its own gives you a
router with nothing attached to it.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `AppSyncEventsAuthorizerMiddleware[]` | No | `[]` | Runs for every request this router authorises, before any route middleware. See [Middleware](#middleware) |

## Register routes

Unlike the GraphQL authorizer, this router holds a list of routes and the first match wins. A client
connects once and then publishes and subscribes many times, and those are three decisions rather than
one.

```ts
eventsAuthorizerRouter.route({
  filters: { operation: 'EVENT_PUBLISH', channelNamespace: 'orders' },
  handler: authoriseOrderPublish,
})
```

**A request that matches no route throws `No authorizer route matched for EVENT_PUBLISH on channel
/orders/eu`.** A failed authorizer answers the caller with 500 and an `AuthorizerFailureException`
carrying the thrown message, so cover every operation the API will ask about.

### Convenience methods

`connect()`, `publish()` and `subscribe()` fill in the `operation` filter. The last two take the
channel path at the top level rather than inside `filters`.

```ts
eventsAuthorizerRouter
  .connect({ handler: admitConnection })
  .publish({ channelPath: '/orders/*', handler: authoriseOrderPublish })
  .subscribe({ channelPath: '/orders/*', handler: authoriseOrderSubscribe })
```

`connect()` takes no channel, because there is none. See [Filters](#filters).

## Filters

| Filter | Type | Matches against |
| --- | --- | --- |
| `operation` | `AppSyncEventsAuthorizerOperation` or an array of them | `EVENT_CONNECT`, `EVENT_PUBLISH` or `EVENT_SUBSCRIBE` |
| `channelPath` | `FilterStringMatcher` | The channel the client named |
| `channelNamespace` | `FilterStringMatcher` | The namespace that channel sits in |
| `custom` | `(input) => boolean` | Whatever you decide, from the whole event |

`channelPath` and `channelNamespace` take a string, a string with `*` in it, a regular expression, or
an array of any of those.

**A channel filter can never match an `EVENT_CONNECT`.** A client names no channel until it publishes
or subscribes, so both fields are absent on a connect and a route that filters on either is skipped.
Register the connect route with `connect()` or with `operation` alone.

## Handler

A handler takes the request and returns a response.

```ts
import type { AppSyncEventsAuthorizerRequest } from '@lambda-event-router/appsync'
import { EventsAuthorized, EventsDenied } from '@lambda-event-router/appsync'

export async function authoriseOrderPublish({ authorizationToken, channelPath }: AppSyncEventsAuthorizerRequest) {
  const team = await teams.fromToken(authorizationToken)
  if (!team?.mayPublishTo(channelPath)) return EventsDenied()

  return EventsAuthorized({ handlerContext: { teamId: team.id } })
}
```

### Request object

Every request carries these.

| Field | Type | Description |
| --- | --- | --- |
| `authorizationToken` | `string` | The token the client sent |
| `requestHeaders` | `Record<string, string \| undefined>` | The headers the client sent |
| `operation` | `AppSyncEventsAuthorizerOperation` | Which of the three decisions this is |
| `apiId` | `string` | The Event API being called |
| `accountId` | `string` | The account the API sits in |
| `requestId` | `string` | AppSync's id for this request |
| `event` | `AppSyncEventsAuthorizerEvent` | The raw event |
| `context` | `Context` | The Lambda context |

A publish and a subscribe add the channel, both as plain strings.

| Field | Type | Description |
| --- | --- | --- |
| `channelPath` | `string` | The channel the client named |
| `channelNamespace` | `string` | The namespace that channel sits in |

A subscribe may name a wildcard channel, so `channelPath` can be `/orders/*` rather than a single
channel. AppSync caches the decision against that literal string.

### Request types

The route decides which request the handler gets, so a publish handler never checks whether there is
a channel.

| Registered with | Request | Holds a channel |
| --- | --- | --- |
| `connect()`, or `operation: 'EVENT_CONNECT'` | `AppSyncEventsAuthorizerConnectRequest` | No |
| `publish()`, `subscribe()`, or a channel operation filter | `AppSyncEventsAuthorizerChannelRequest` | Yes |
| `route()` with no operation filter | `AppSyncEventsAuthorizerRequest` | Optional |

```ts
eventsAuthorizerRouter.publish({
  channelPath: '/orders/*',
  handler: async ({ channelPath }) => {
    // channelPath is a string, with nothing to narrow
    return teams.mayPublishTo(channelPath) ? EventsAuthorized() : EventsDenied()
  },
})
```

## Responses

```ts
import { EventsAuthorized, EventsDenied } from '@lambda-event-router/appsync'

EventsAuthorized()                                       // { isAuthorized: true }
EventsAuthorized({ handlerContext: { teamId: 'a-1' } })   // reaches the handler as identity.handlerContext
EventsAuthorized({ ttlOverride: 0 })                      // do not cache this decision
EventsDenied()                                            // { isAuthorized: false }
```

**An Event API reads `handlerContext`, never `resolverContext`.** The two are the same idea on
different surfaces, and the wrong one is dropped without an error, so `Authorized()` from the GraphQL
authorizer looks like it worked and delivers nothing. There is no `deniedFields` here either: an
Event API has no fields to deny.

`handlerContext` takes key-value pairs of strings and reaches your publish and subscribe handlers as
`identity.handlerContext`.

```ts
export async function onOrderPublish({ identity, events }: AppSyncEventsRequest) {
  const teamId = identity?.handlerContext?.teamId
  return { events }
}
```

### Caching

AppSync caches a decision for five minutes by default, keyed on the API, the operation, the channel
and the token. A connect is keyed without the channel, since it has none. `ttlOverride` changes that
per response, and 0 turns it off.

### Throwing

A response thrown anywhere in the chain is caught and returned, which is how middleware refuses a
request without the handler running.

```ts
if (isExpired(authorizationToken)) throw EventsDenied()
```

**Only a response is caught.** The router checks a thrown value for a boolean `isAuthorized`, so a
thrown `Error` is not one. `isAppSyncEventsAuthorizerResponse` is that check, exported so you can run
it yourself.

**Anything else thrown fails the invocation.** The router rethrows it untouched, so Lambda records the
error and the caller gets 500 with an `AuthorizerFailureException` carrying your message. An
`EventsDenied()` answers 401 with `UnauthorizedException` and tells the caller nothing, so keep it for
a refusal you mean.

## Middleware

Router and route middleware are both typed `AppSyncEventsAuthorizerMiddleware`, and the chain runs
once per authorisation. Router middleware runs first.

```ts
import type { AppSyncEventsAuthorizerMiddleware } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

export const logChannelAuthorisation: AppSyncEventsAuthorizerMiddleware = async (request, next) => {
  logger.info({ message: 'Authorising channel request', operation: request.operation })
  return next(request)
}
```

Middleware runs after a route has matched, so a request that matches nothing never reaches it.

## Types

All exported from `@lambda-event-router/appsync`.

| Type | Description |
| --- | --- |
| `AppSyncEventsAuthorizerRequest` | The handler argument on a route with no operation filter |
| `AppSyncEventsAuthorizerConnectRequest` | The handler argument on a connect route |
| `AppSyncEventsAuthorizerChannelRequest` | The handler argument on a publish or subscribe route |
| `AppSyncEventsAuthorizerBaseRequest` | What all three share |
| `AppSyncEventsAuthorizerResponse` | What a handler returns |
| `AppSyncEventsAuthorizerEvent` | The event AppSync delivers |
| `AppSyncEventsAuthorizerOperation` | `EVENT_CONNECT`, `EVENT_PUBLISH` or `EVENT_SUBSCRIBE` |
| `AppSyncEventsAuthorizerFilters` | The `filters` object |
| `AppSyncEventsAuthorizerFilterInput` | What `custom` receives |
| `AppSyncEventsAuthorizerChannelFilters` | The `filters` object on the convenience methods, which is `custom` on its own |
| `AppSyncEventsAuthorizerRouteDefinition` | A full route passed to `route()` |
| `AppSyncEventsAuthorizerMiddleware` | Router and route middleware |
| `AppSyncEventsAuthorizerRouterOptions` | Options for `createAppSyncEventsAuthorizerRouter` |

## Code example

```ts
// authorizer.ts
import { LambdaRouter } from '@lambda-event-router/base'

import { eventsAuthorizerRouter } from './eventsAuthorizerRouter'
import { graphqlAuthorizerRouter } from './graphqlAuthorizerRouter'

const lambdaRouter = new LambdaRouter({ routers: [graphqlAuthorizerRouter, eventsAuthorizerRouter] })

export const handler = lambdaRouter.handler()
```

```ts
// eventsAuthorizerRouter.ts
import { createAppSyncEventsAuthorizerRouter, EventsAuthorized, EventsDenied } from '@lambda-event-router/appsync'

export const eventsAuthorizerRouter = createAppSyncEventsAuthorizerRouter()

eventsAuthorizerRouter
  .connect({
    handler: async ({ authorizationToken }) => {
      const team = await teams.fromToken(authorizationToken)
      return team ? EventsAuthorized() : EventsDenied()
    },
  })
  .publish({
    channelPath: '/orders/*',
    handler: async ({ authorizationToken, channelPath }) => {
      const team = await teams.fromToken(authorizationToken)
      if (!team?.mayPublishTo(channelPath)) return EventsDenied()

      return EventsAuthorized({ handlerContext: { teamId: team.id } })
    },
  })
  .subscribe({ channelPath: '/orders/*', handler: async () => EventsAuthorized() })
```

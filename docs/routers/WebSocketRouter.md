# WebSocketRouter

`WebSocketRouter` routes Amazon API Gateway WebSocket events to handlers, one event per invocation.

A WebSocket API invokes your Lambda across the life of a connection: once when a client connects, once
for every message it sends and once when it disconnects. Your routes match on which of those arrived
and on the message's route key, and the router hands your handler the connection id it needs to answer.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/apigateway
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

`@aws-sdk/client-apigatewaymanagementapi` comes along as a dependency. It is what
[`postToConnection`](#sending-messages-to-a-client) sends through, so there is nothing extra to add to
answer a client.

## Create the router

```ts
import { createWebSocketRouter } from '@lambda-event-router/apigateway'
import { withTiming } from './middleware/withTiming'

const wsRouter = createWebSocketRouter({
  middleware: [withTiming],  // Optional
})
```

`middleware` is the only option and it can be left out. A WebSocket API has no CORS to answer, so
everything else this router does is set on the routes. See [Middleware](#middleware).

## Register routes

```ts
wsRouter.route({
  filters: {
    eventType: 'MESSAGE',  // Optional
    routeKey: 'sendMessage',  // Optional
  },
  bodySchema: SendMessageSchema,  // Optional
  middleware: [withRoomContext],  // Optional
  handler: sendMessage,
})
```

`filters` and `handler` are the only required keys, and every key inside `filters` is optional, so
`filters: {}` registers a catch-all.

`route()` returns the router, so you can chain registrations.

```ts
wsRouter.route(connectRoute).route(sendMessageRoute).route(disconnectRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. Both filter keys are exact matches, which makes that easy: one route per route key never
competes with another. See [match order](/docs/routing#match-order) for what goes wrong when they
overlap.

**When nothing matches, the router throws and the invocation fails.** The message names the event type
and the route key it could not place, and no handler runs. A `$connect` with no route never opens the
connection, and a message with no route sends the client nothing back. See [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

**A WebSocket API sends `$connect` and `$disconnect` whether you have registered them or not.** A
router carrying only message routes throws on every connection attempt, so cover all three event types
or add a catch-all.

### Convenience methods

`connect()`, `disconnect()` and `message()` fill in the `eventType` filter for you.

```ts
// Both of these register the same route
wsRouter.message({
  filters: { routeKey: 'sendMessage' },
  bodySchema: SendMessageSchema,
  handler: sendMessage,
})

wsRouter.route({
  filters: { eventType: 'MESSAGE', routeKey: 'sendMessage' },
  bodySchema: SendMessageSchema,
  handler: sendMessage,
})
```

| Method | Sets | Also takes | Handler returns |
| --- | --- | --- | --- |
| `connect()` | `eventType: 'CONNECT'` | `filters`, `middleware`, `handler` | A status code, or nothing |
| `disconnect()` | `eventType: 'DISCONNECT'` | `filters`, `middleware`, `handler` | Nothing |
| `message()` | `eventType: 'MESSAGE'` | `filters`, `bodySchema`, `middleware`, `handler` | Nothing |

Each one takes the same `filters` object `route()` does, minus the `eventType` it fills in for you, so
`routeKey` and `custom` work here exactly as they do on `route()`. `message()` is the only one that
also takes a `bodySchema`, so a connect route that needs one goes through `route()`. See [convenience
methods](/docs/routing#convenience-methods) for how the other routers use them.

## Filters

Two keys match on the event, plus a `custom`. Every one of them is optional.

```ts
wsRouter.route({
  filters: {
    eventType: 'MESSAGE',
    routeKey: 'sendMessage',
  },
  bodySchema: SendMessageSchema,
  handler: sendMessage,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `eventType` | `'CONNECT' \| 'MESSAGE' \| 'DISCONNECT'` | Which point in the connection's life this event is. One value, not a `FilterStringMatcher`, so no array and no pattern |
| `routeKey` | `string` | The route key API Gateway picked. An exact match, so no array and no pattern |
| `custom` | `(input: WebSocketFilterInput) => boolean \| Promise<boolean>` | Given `{ eventType, routeKey, body, event }`. Can be async |

Neither key is a [`FilterStringMatcher`](/docs/routing#filters), so neither takes an array or a
`RegExp` the way `bucket` on S3 or `messageAttributes` on SNS do. Matching a family of route keys is
what a `custom` is for here, since `{ routeKey: 'admin:kick' }` and `{ routeKey: 'admin:ban' }`
are two registrations while `routeKey.startsWith('admin:')` is one.

`routeKey` and a `custom` reading the route key are two ways of picking the same message, so a
route wants one or the other rather than both.

```ts
wsRouter.route({
  filters: {
    eventType: 'MESSAGE',
    custom: ({ routeKey }) => routeKey.startsWith('admin:'),
  },
  handler: adminAction,
})
```

`custom` also gets the parsed frame as `body` and the raw event, so it can route on a field inside
the message. The body reaches it before any `bodySchema` runs, so it is `unknown` and wants a guard.

```ts
import { isObject } from '@lambda-event-router/base'

wsRouter.message({
  filters: {
    custom: ({ body }) => isObject(body) && body.priority === 'urgent',
  },
  handler: urgentAction,
})
```

See [`custom`](/docs/routing#custom) for where it sits in the filter order.

### Route keys

The route key is API Gateway's word for what the client asked for, and it is set on the API rather than
here. `$connect` and `$disconnect` are fixed, and the rest come from the API's route selection
expression, usually `$request.body.action`.

| The client | `eventType` | `routeKey` |
| --- | --- | --- |
| Opens the connection | `CONNECT` | `$connect` |
| Sends `{"action":"sendMessage"}` | `MESSAGE` | `sendMessage` |
| Sends an action with no route on the API | `MESSAGE` | `$default` |
| Closes the connection, or API Gateway does | `DISCONNECT` | `$disconnect` |

A route key only reaches your Lambda if the API has a route for it, so adding a route key here means
adding it on the API too. The exception is `$default`, which catches every action the API has no route
for, and registering it is how you stop an unknown action failing the invocation.

The two filter keys overlap on the fixed keys, so `{ eventType: 'CONNECT' }` and
`{ routeKey: '$connect' }` register the same route. `eventType` reads better for the connection
lifecycle and `routeKey` for messages.

## Handler

Handlers take one argument. A connect handler answers with a status code and the other two return
nothing.

```ts
import type { WebSocketMessageRequest } from '@lambda-event-router/apigateway'
import { postToConnection } from '@lambda-event-router/apigateway'

export async function sendMessage(request: WebSocketMessageRequest<SendMessage>): Promise<void> {
  const { connectionId, domainName, stage, body } = request

  await postToConnection({
    domainName,
    stage,
    connectionId,
    data: JSON.stringify({ roomId: body.roomId, content: body.content }),
  })
}
```

### Request object

Every request carries these.

| Field | Type | Description |
| --- | --- | --- |
| `connectionId` | `string` | The connection this event came from. Store it, and post back through it |
| `domainName` | `string` | The API's domain name |
| `stage` | `string` | The API stage |
| `eventType` | `'CONNECT'`, `'MESSAGE'` or `'DISCONNECT'` | Pinned to one value on each request type, so you can narrow on it |
| `routeKey` | `string` | The route key API Gateway matched |
| `event` | `WebSocketEvent` | The untouched event from AWS, for `requestContext` and anything else you need |
| `context` | `Context` | The Lambda context |

On top of those, each event type carries the one field that belongs to it.

| Request | Extra field | Type |
| --- | --- | --- |
| `WebSocketConnectRequest` | `queryStringParameters` | `Record<string, string> \| undefined` |
| `WebSocketMessageRequest<TBody>` | `body` | `TBody` |
| `WebSocketDisconnectRequest` | none | |

`Context` comes from `aws-lambda`, not from this package. `WebSocketEvent` types `event` and is
exported from here.

A body that is not valid JSON arrives as the raw string, and no body at all as `undefined`, so a client
sending plain text is something a handler can still read.

**The query string only arrives on the connect event,** and `body` only on a message. API Gateway
carries each on one event type and nowhere else, so the field is absent from the other request types
rather than present and empty. A message handler reaching for `queryStringParameters` does not compile.
A token you need later belongs on whatever you store the connection in.

`domainName` and `stage` are on the request so a handler can post back without knowing how the API is
deployed. Every connection on the same stage shares both, so the pair off the event you are handling
works for any connection id you have stored.

### Response type

`WebSocketConnectResponse` is a bare `{ statusCode: number }` or nothing. A connect handler returns one
of those to accept or refuse the handshake, and a message or disconnect handler returns nothing. It
types out `body` and `headers`, so an HTTP response helper does not assign to it. See
[Responses](#responses) for what the router does with it.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineWebSocketRoute` reads the filters and the schema
and hands your handler a typed `body` and `queryStringParameters`, so `token` below is a `string` and
`body` matches `SendMessageSchema` without you declaring either.

```ts
import { defineWebSocketRoute, WebSocketOk, WebSocketUnauthorised } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'

export const connectRoute = defineWebSocketRoute({
  filters: { eventType: 'CONNECT' },
}).handle(async ({ connectionId, queryStringParameters }) => {
  const token = queryStringParameters?.token
  if (!token) return WebSocketUnauthorised()

  await connections.add(connectionId, token)
  logger.info(`Connection ${connectionId} opened`)

  return WebSocketOk()
})

wsRouter.route(connectRoute)
```

The `eventType` filter is what picks the request type. A route filtered to `CONNECT` hands the handler
a `WebSocketConnectRequest`, `MESSAGE` a `WebSocketMessageRequest` and `DISCONNECT` a
`WebSocketDisconnectRequest`. Leave `eventType` out and the handler gets all three, so narrow on
`request.eventType` before reaching for `body` or `queryStringParameters`. `connect()`, `message()` and
`disconnect()` set the filter themselves, so they hand you the narrowed request without you asking.

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using the request type for the
event you are handling and your own types.

```ts
// handlers/rooms.ts
import type { WebSocketMessageRequest } from '@lambda-event-router/apigateway'
import { postToConnection } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'
import { z } from 'zod'

export const SendMessageSchema = z.object({
  action: z.literal('sendMessage'),
  roomId: z.string(),
  content: z.string(),
})
type SendMessage = z.infer<typeof SendMessageSchema>

export async function sendMessage(request: WebSocketMessageRequest<SendMessage>): Promise<void> {
  const { connectionId, domainName, stage, body } = request
  const data = JSON.stringify({ roomId: body.roomId, content: body.content, from: connectionId })

  for (const id of await connections.inRoom(body.roomId)) {
    await postToConnection({ domainName, stage, connectionId: id, data })
  }

  logger.info(`Broadcast a message to room ${body.roomId} from ${connectionId}`)
}
```

```ts
// websocket.ts
import { createWebSocketRouter } from '@lambda-event-router/apigateway'

import { sendMessage, SendMessageSchema } from './handlers/rooms.js'

const wsRouter = createWebSocketRouter()

wsRouter.message({
  filters: { routeKey: 'sendMessage' },
  bodySchema: SendMessageSchema,
  handler: sendMessage,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
[Annotated handlers](/docs/handlers#annotated-handlers) has the worked version.

One request type per event type saves you naming the parameters at all, so
`WebSocketMessageRequest<SendMessage>` above rather than the `WebSocketRequest` union.
[Types](#types) lists all four.

Annotate a route you write in its own file with the type for its event type:
`WebSocketConnectRouteDefinition`, `WebSocketMessageRouteDefinition<TBody>` or
`WebSocketDisconnectRouteDefinition`. Each pins the filters, the request and the return type, so a
connect handler will not assign to a message route. `WebSocketRouteDefinition<TBody>` covers a route
that handles more than one event type, and its handler takes all three requests.

## Schema validation

One key takes a schema and it is optional.

```ts
const SendMessageSchema = z.object({
  action: z.literal('sendMessage'),
  roomId: z.string(),
  content: z.string(),
})

wsRouter.route({
  filters: { eventType: 'MESSAGE', routeKey: 'sendMessage' },
  bodySchema: SendMessageSchema,
  handler: sendMessage,
})
```

| Key | Validates | A failure |
| --- | --- | --- |
| `bodySchema` | The parsed message body | Throws, and the handler never runs |

Any [Standard Schema](https://standardschema.dev) library works. Your handler gets the validated
output, so coercion and defaults are applied and unknown keys are stripped before it runs. See [schema
validation](/docs/routing#schema-validation) for what your handler receives after coercion.

**A `bodySchema` on a connect or disconnect route fails every event.** Neither carries a body, so the
router hands `undefined` to the schema and a `z.object()` rejects it. Keep the schema on message
routes.

The route selection expression has already read the body by the time your Lambda is invoked, so the
`action` field is what picked the route key rather than something the schema decides. Keeping it in the
schema is still worth it for the narrowing, which is what `z.literal` gives you.

## Responses

Whatever a handler returns, the router turns it into a `{ statusCode }` for Lambda.

| You return | You get |
| --- | --- |
| Nothing | 200 |
| An object with a numeric `statusCode` and nothing else | That status code |
| Anything else | 200, the value is dropped and a warning is logged |

### Response helpers

Three helpers cover the status codes a connect handler needs, and none of them takes an argument.

| Helper | Status |
| --- | --- |
| `WebSocketOk()` | 200 |
| `WebSocketUnauthorised()` | 401 |
| `WebSocketForbidden()` | 403 |

For any other code, hand back the object yourself.

```ts
return { statusCode: 429 }
```

Only the connect event does anything with the code: a non-2xx refuses the handshake and the client's
connection attempt fails. Nothing a message or disconnect handler returns reaches the client, which is
why both are typed to return nothing, and why [`postToConnection`](#sending-messages-to-a-client) is
how you answer a message.

### Throwing

Throwing a helper works the same as returning it, and it carries the same weight from any depth, so a
token check three calls below your handler can refuse a connection without every function in between
passing a failure back up.

```ts
import { WebSocketForbidden } from '@lambda-event-router/apigateway'

const user = await users.fromToken(token)
if (!user) throw WebSocketForbidden()
```

**Anything else thrown fails the invocation.** The router rethrows it untouched, so Lambda records the
error and API Gateway refuses the handshake on a `$connect`.

**Reach for the `WebSocket` prefixed helpers, not the HTTP ones.** This package exports `Unauthorised`,
`Forbidden` and the rest for [`APIGatewayRouter`](/routers/APIGatewayRouter), so autocomplete offers you
both families.

Returning an HTTP helper does not compile, because `WebSocketConnectResponse` types out the `body` and
`headers` it carries. Throwing one still answers with its status code, which is the same code the
matching `WebSocket` helper would give you, and logs a warning naming the helper you wanted. Nothing
reaches the client either way: a WebSocket answer is a status code alone, so the body and headers had
nowhere to go.

## Sending messages to a client

`postToConnection` sends data down an open connection through the API Gateway Management API. It is the
only way to reach a client, since a handler's return value never gets there.

```ts
import { postToConnection } from '@lambda-event-router/apigateway'

await postToConnection({
  domainName,
  stage,
  connectionId,
  data: JSON.stringify({ roomId, content }),
})
```

| Field | Type | Description |
| --- | --- | --- |
| `domainName` | `string` | The API's domain name, off the request |
| `stage` | `string` | The API stage, off the request |
| `connectionId` | `string` | Who to send to. Any connection on the same stage, not only the one you were invoked for |
| `data` | `string` | The payload. Serialise it yourself |
| `client` | `ApiGatewayManagementApiClient` | Optional. Your own client to send through. Leave it out and we reuse a cached one per endpoint |

The callback URL is built as `https://<domainName>/<stage>`, so the three fields off the request are
all you need to reply to the sender. Broadcasting is the same call against every connection id you have
stored, which is why storing them at connect time is the first thing a connect handler does.

We cache one client per endpoint and reuse it across calls, so a broadcast to a room pays a single
handshake rather than one per connection. Pass your own `client` when you want to configure it
yourself, for example with a custom retry policy.

Your function's role needs `execute-api:ManageConnections` on the API. Without it every call fails with
an access denied error rather than anything WebSocket specific.

**A client that has gone away fails the call rather than the send being skipped.** The SDK throws
`GoneException` for a connection id that is no longer open, so a broadcast wants to catch it per
connection and drop the stored id.

```ts
import { GoneException } from '@aws-sdk/client-apigatewaymanagementapi'

for (const id of await connections.inRoom(roomId)) {
  try {
    await postToConnection({ domainName, stage, connectionId: id, data })
  } catch (error) {
    if (!(error instanceof GoneException)) throw error
    await connections.remove(id)
  }
}
```

## Middleware

Router and route middleware are both typed `WebSocketMiddleware`, and the chain runs once per event.

```ts
import type { WebSocketMiddleware } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'

export const withTiming: WebSocketMiddleware = async (request, next) => {
  logger.appendKeys({ connectionId: request.connectionId })

  return next(request)
}
```

`WebSocketMiddleware<TBody>` takes the body type, so route middleware on a route with a `bodySchema`
reads the same typed `request.body` the handler does. Leave it off for `unknown`.

```ts
const wsRouter = createWebSocketRouter({ middleware: [withTiming] })

wsRouter.message<SendMessage>({
  bodySchema: SendMessageSchema,
  middleware: [withRoomContext],
  handler: sendMessage,
})
```

Router middleware runs before route middleware, and both run before the handler. A middleware can
short-circuit by returning a `{ statusCode }` response without calling `next`, and a response thrown
from inside the chain is caught the same way a throw from the handler is. A failing `bodySchema` throws
before the chain starts, so middleware never sees it. See [middleware](/docs/middleware) for the
execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/apigateway`.

| Type | Description |
| --- | --- |
| `WebSocketConnectRequest` | A connect handler's argument, carrying the query string |
| `WebSocketMessageRequest<TBody>` | A message handler's argument, carrying the body |
| `WebSocketDisconnectRequest` | A disconnect handler's argument, carrying neither |
| `WebSocketRequest<TBody>` | The union of those three, for a handler serving more than one |
| `WebSocketBaseRequest` | The fields all three share |
| `WebSocketConnectResponse` | Handler return type, a bare `{ statusCode: number }` or `undefined` |
| `WebSocketResult` | `{ statusCode: number }`, what the router hands back to Lambda |
| `WebSocketHandler<TBody>` | The `handler` function, returning a status code or nothing |
| `WebSocketMiddleware<TBody>` | Router and route middleware |
| `WebSocketConnectRouteDefinition` | A full connect route, and the argument to `connect()` |
| `WebSocketMessageRouteDefinition<TBody>` | A full message route, and the argument to `message()` |
| `WebSocketDisconnectRouteDefinition` | A full disconnect route, and the argument to `disconnect()` |
| `WebSocketRouteDefinition<TBody>` | A full route for any event type, as `defineWebSocketRoute` builds it |
| `WebSocketRouterOptions` | Options for `createWebSocketRouter` |
| `PostToConnectionInput` | The argument to `postToConnection` |
| `WebSocketFilters` | The `filters` key |
| `WebSocketFilterInput` | What a `custom` is given |
| `WebSocketEvent` | `request.event` |
| `WebSocketEventType` | `'CONNECT' \| 'MESSAGE' \| 'DISCONNECT'` |

`Context` on the request comes from `aws-lambda`, and `WebSocketEvent` extends that package's
`APIGatewayProxyWebsocketEventV2WithRequestContext` with the `headers` and `queryStringParameters` a
`$connect` carries.

The `WebSocketRouter` class and the `createWebSocketRouter` and `defineWebSocketRoute` functions come
from the same place, along with the three response helpers, `isWebSocketResponse` and
`postToConnection`.

### Generic parameters

| Parameter | Types | Default |
| --- | --- | --- |
| `TBody` | `request.body` | `unknown` |

`TBody` is the only one. `WebSocketRequest`, `WebSocketMessageRequest`, `WebSocketMessageRouteDefinition`,
`WebSocketRouteDefinition`, `WebSocketHandler` and `WebSocketMiddleware` all take it.
`WebSocketConnectRequest` and `WebSocketDisconnectRequest` take nothing, since neither carries a body.

You only need these for [annotated handlers](#annotated-handlers). Inference covers both.

## Code example

A chat API, storing connections as they open, broadcasting a message to everyone in a room and clearing
up on disconnect.

Open a file: [index.ts](#websocket-example:index.ts) | [WebSocket router](#websocket-example:websocket.ts) | [handlers](#websocket-example:handlers/rooms.ts) | [schemas](#websocket-example:schemas/message.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { wsRouter } from './websocket.js'

const lambdaRouter = new LambdaRouter({
  routers: [wsRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'websocket.ts',
    code: `import { createWebSocketRouter } from '@lambda-event-router/apigateway'

import { joinRoom, onConnect, onDisconnect, sendMessage, unknownAction } from './handlers/rooms.js'
import { JoinRoomSchema, SendMessageSchema } from './schemas/message.js'

export const wsRouter = createWebSocketRouter()

wsRouter
  .connect({ handler: onConnect })
  .disconnect({ handler: onDisconnect })
  .message({
    filters: { routeKey: 'joinRoom' },
    bodySchema: JoinRoomSchema,
    handler: joinRoom,
  })
  .message({
    filters: { routeKey: 'sendMessage' },
    bodySchema: SendMessageSchema,
    handler: sendMessage,
  })
  .message({
    filters: { routeKey: '$default' },
    handler: unknownAction,
  })`,
  },
  {
    path: 'handlers/rooms.ts',
    code: `import { GoneException } from '@aws-sdk/client-apigatewaymanagementapi'
import type {
  WebSocketConnectRequest,
  WebSocketConnectResponse,
  WebSocketDisconnectRequest,
  WebSocketMessageRequest,
} from '@lambda-event-router/apigateway'
import { postToConnection, WebSocketOk, WebSocketUnauthorised } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'

import { connections } from '../connections.js'
import type { JoinRoom, SendMessage } from '../schemas/message.js'

export async function onConnect(request: WebSocketConnectRequest): Promise<WebSocketConnectResponse> {
  const { connectionId, queryStringParameters } = request

  const token = queryStringParameters?.token
  if (!token) {
    return WebSocketUnauthorised()
  }

  await connections.add(connectionId, token)
  logger.info(\`Connection \${connectionId} opened\`)

  return WebSocketOk()
}

export async function onDisconnect({ connectionId }: WebSocketDisconnectRequest): Promise<void> {
  await connections.remove(connectionId)
  logger.info(\`Connection \${connectionId} closed\`)
}

export async function joinRoom(request: WebSocketMessageRequest<JoinRoom>): Promise<void> {
  const { connectionId, body } = request

  await connections.join(connectionId, body.roomId)
  logger.info(\`Connection \${connectionId} joined room \${body.roomId}\`)
}

export async function sendMessage(request: WebSocketMessageRequest<SendMessage>): Promise<void> {
  const { connectionId, domainName, stage, body } = request
  const data = JSON.stringify({ roomId: body.roomId, content: body.content, from: connectionId })

  for (const id of await connections.inRoom(body.roomId)) {
    try {
      await postToConnection({ domainName, stage, connectionId: id, data })
    } catch (error) {
      // A client that has closed since we stored it answers 410, so forget it and carry on
      if (!(error instanceof GoneException)) throw error
      await connections.remove(id)
    }
  }

  logger.info(\`Broadcast a message to room \${body.roomId} from \${connectionId}\`)
}

export async function unknownAction(request: WebSocketMessageRequest): Promise<void> {
  const { connectionId, routeKey } = request

  logger.warn(\`Connection \${connectionId} sent an action with no route, arriving as \${routeKey}\`)
}`,
  },
  {
    path: 'schemas/message.ts',
    code: `import { z } from 'zod'

export const JoinRoomSchema = z.object({
  action: z.literal('joinRoom'),
  roomId: z.string(),
})

export const SendMessageSchema = z.object({
  action: z.literal('sendMessage'),
  roomId: z.string(),
  content: z.string(),
})

export type JoinRoom = z.infer<typeof JoinRoomSchema>
export type SendMessage = z.infer<typeof SendMessageSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="websocket-example" default-file="websocket.ts" line-numbers collapse-toggle fixed-height />

Every route carries a filter no other route can match, so the order they are registered in makes no
difference. `$default` catches any action the API has a route for and this Lambda does not, which keeps
an unrecognised message off the [nothing matched](#register-routes) path.

The schemas live in one file and are attached to the routes in `websocket.ts` rather than next to the
handlers, which keeps the handlers free of anything about how the message arrived. `onConnect` is the
only handler answering with a status code, and the rest reply through `postToConnection` or not at all.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

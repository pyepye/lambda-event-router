# @lambda-event-router/apigateway

Provides routers for API Gateway event sources: REST APIs, HTTP APIs, Lambda Authorizers and WebSocket connections.

**Supported AWS Services:** `Amazon API Gateway`

**Available Routers:** `APIGatewayRouter` | `LambdaAuthorizerRouter` | `WebSocketRouter`

(See [Routers](#routers) for more details)

## Install

```bash
npm install @lambda-event-router/apigateway
```


## Quick Start

This example is for the APIGatewayRouter. For see [Usage](#usage) for examples of the other routers

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { apiRouter } from './api'

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// api.ts
import { createAPIGatewayRouter, defineRoute } from '@lambda-event-router/apigateway'
import { z } from 'zod'

const apiRouter = createAPIGatewayRouter()

const ItemSchema = z.object({ name: z.string(), price: z.number() })

// Inline functions allow Typescript to infer the types automatically
const updateItem = defineRoute({
  filters: {
    method: 'PUT',
    path: '/org/:orgId/items/:itemId',
  },
  bodySchema: ItemSchema,
}).handle(async ({ path, body }) => {
  return { orgId: path.orgId, name: body.name, price: body.price }
})
apiRouter.route(updateItem)
```

OR use the separate syntax to split router and handlers across files:

```ts
// api.ts
import { type ApiRequest, createAPIGatewayRouter } from '@lambda-event-router/apigateway'
import { z } from 'zod'

const apiRouter = createAPIGatewayRouter()

const ItemSchema = z.object({ name: z.string(), price: z.number() })
type Item = z.infer<typeof ItemSchema>

// Separate handler to define routes and handlers in different places
apiRouter.put({
  filters: {
    path: '/org/:orgId/items/:itemId',
  },
  bodySchema: ItemSchema,
  handler: updateItem,
})

// A separate handler needs its types spelling out, since there is no schema in scope to infer from
export async function updateItem(
  request: ApiRequest<{ orgId: string; itemId: string }, Record<string, string | undefined>, Item>,
): Promise<Item & { orgId: string }> {
  const { path, body } = request
  return { orgId: path.orgId, name: body.name, price: body.price }
}
```


## Routers

| AWS Service | Event Source | Router | Usage
|---|---|---|---|
| API Gateway | REST API | `APIGatewayRouter` | <Usage link here> |
| API Gateway | HTTP API | `APIGatewayRouter` | <Usage link here> |
| API Gateway | Lambda Authorizer | `LambdaAuthorizerRouter` | <Usage link here> |
| API Gateway | WebSocket | `WebSocketRouter` | <Usage link here> |

See `@lambda-event-router/alb` and `@lambda-event-router/vpclattice` for how to deal with HTTP requests from those services.


## Usage

### APIGatewayRouter

The API Gateway router can handle any version of the API Gateway event source (Rest API, HTTP API payload 1.0 and 2.0)

```ts

import { LambdaRouter } from '@lambda-event-router/base'
import { apiRouter } from './api'

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter]
})

export const handler = lambdaRouter.handler()
```


#### Inline handlers

```ts
// api.ts
import { createAPIGatewayRouter, defineRoute } from '@lambda-event-router/apigateway'

const apiRouter = createAPIGatewayRouter()

const updateItemRoute = defineRoute({
  filters: {
    method: 'POST',
    path: '/orgs/:orgId/items/:itemId',
  },
  querySchema: QuerySchema,
  bodySchema: BodySchema,
  responseSchema: ResponseSchema,
}).handle(async ({ path, query, body, auth }) => {
  const { orgId, itemId } = path
  const { dryRun } = query
  return { orgId, itemId, name: body.name, price: body.price, dryRun }
})

apiRouter.route(updateItemRoute);
```

#### Separate handlers

```ts
// api.ts
import type { ApiRequest, ApiResponse } from '@lambda-event-router/apigateway'
import { createAPIGatewayRouter, NotFound, Ok } from '@lambda-event-router/apigateway'

const apiRouter = createAPIGatewayRouter()

apiRouter.get({
  filters: {
    path: '/orgs/:orgId/items/:itemId',
  },
  handler: getItemHandler,
})

export async function getItemHandler(
  request: ApiRequest<{ orgId: string; itemId: string }>,
): Promise<ApiResponse<{ orgId: string; name: string; price: number }>> {
  const { path } = request
  const item = await getItem(path.itemId)
  if (!item) {
    throw NotFound({ error: `${path.itemId} not found` })
  }
  return Ok({ orgId: path.orgId, name: item.name, price: item.price })
}
```

#### Helper methods

```ts
apiRouter.get()
apiRouter.put()
apiRouter.post()
apiRouter.patch()
apiRouter.delete()
apiRouter.head()
apiRouter.options()
```

An `options()` route takes precedence over the automatic CORS preflight, so it is how you answer a
preflight yourself.

#### Responses

The helpers take the response body rather than a message string, so pass the object you want on the
wire.

```ts
return { data: ... } // By default this will resolve to a 200 with the body as JSON
return // By default this will resolve to a 204

return Ok(data)
return Created(data)
return NoContent()
// Non-2xx responses are usually thrown, but they can be returned as well
throw TemporaryRedirect(location)
throw PermanentRedirect(location)
throw BadRequest({ error: 'Missing orgId' })
throw Unauthorised()
throw Forbidden()
throw NotFound({ error: `${itemId} not found` })
throw Conflict({ error: 'Item already exists' })
throw UnprocessableContent({ error: 'Price must be positive' })
throw InternalServerError()
```

### LambdaAuthorizerRouter

```ts
import { createLambdaAuthorizerRouter, defineLambdaAuthorizerRoute, Allow, Deny } from '@lambda-event-router/apigateway'

const authRouter = createLambdaAuthorizerRouter()

authRouter.route(
  defineLambdaAuthorizerRoute({
    filters: { type: 'TOKEN' },
  }).handle(async ({ authorizationToken }) => {
    if (authorizationToken === 'valid-token') return Allow('user-123')
    return Deny()
  })
)
```

#### Separate handlers
```ts
import { createLambdaAuthorizerRouter } from '@lambda-event-router/apigateway'

const authRouter = createLambdaAuthorizerRouter()

authRouter.token({
  handler: validateToken,
})

authRouter.request({
  method: 'GET',
  handler: validateRequest,
})

async function validateToken({ authorizationToken, resourceArn }) {
  if (authorizationToken === 'valid-token') return Allow('user-123', resourceArn)
  return Deny('anonymous', resourceArn)
}

async function validateRequest({ headers, resourceArn }) {
  const apiKey = headers['x-api-key']
  if (apiKey === 'valid-key') return Allow('user-123', resourceArn)
  return Deny('anonymous', resourceArn)
}
```

#### Helper methods

```ts
authRouter.token()
authRouter.request()
```

#### Responses

```ts
return Allow(principalId, resource)
return Allow(principalId, resource, context) // with additional context
return Deny(principalId, resource)
return true  // simple response mode (HTTP API v2 request authorizers only)
return false // simple response mode (HTTP API v2 request authorizers only)
```

### WebSocketRouter

A WebSocket API invokes the Lambda three ways over a connection's life, so routes filter on `eventType`
and on the `routeKey` API Gateway picked.

#### Inline handlers

```ts
import { createWebSocketRouter, defineWebSocketRoute, postToConnection } from '@lambda-event-router/apigateway'
import { z } from 'zod'

const wsRouter = createWebSocketRouter()

const SendMessageSchema = z.object({ action: z.literal('sendMessage'), content: z.string() })

wsRouter.route(
  defineWebSocketRoute({
    filters: { eventType: 'MESSAGE', routeKey: 'sendMessage' },
    bodySchema: SendMessageSchema,
  }).handle(async ({ connectionId, domainName, stage, body }) => {
    await postToConnection({ domainName, stage, connectionId, data: JSON.stringify({ echo: body.content }) })
  })
)
```

#### Separate handlers
```ts
import type {
  WebSocketConnectRequest,
  WebSocketConnectResponse,
  WebSocketDisconnectRequest,
  WebSocketMessageRequest,
} from '@lambda-event-router/apigateway'
import { createWebSocketRouter, WebSocketOk, WebSocketUnauthorised } from '@lambda-event-router/apigateway'
import { z } from 'zod'

const wsRouter = createWebSocketRouter()

const SendMessageSchema = z.object({ action: z.literal('sendMessage'), content: z.string() })
type SendMessage = z.infer<typeof SendMessageSchema>

wsRouter.connect({
  handler: onConnect,
})

wsRouter.disconnect({
  handler: onDisconnect,
})

wsRouter.message({
  routeKey: 'sendMessage',
  bodySchema: SendMessageSchema,
  handler: onSendMessage,
})

// Only a CONNECT event carries the query string, and only a CONNECT handler answers with a status code
async function onConnect({ connectionId, queryStringParameters }: WebSocketConnectRequest): Promise<WebSocketConnectResponse> {
  if (!queryStringParameters?.token) return WebSocketUnauthorised()
  // Store connection
  return WebSocketOk()
}

async function onDisconnect({ connectionId }: WebSocketDisconnectRequest): Promise<void> {
  // Remove connection
}

async function onSendMessage({ connectionId, body }: WebSocketMessageRequest<SendMessage>): Promise<void> {
  // Handle message
}
```

#### Helper methods

```ts
wsRouter.connect()
wsRouter.disconnect()
wsRouter.message()
```

Only `defineWebSocketRoute` accepts a `customFilter`. `route()` and the three methods above do not.

#### Responses

```ts
return WebSocketOk()          // 200
throw WebSocketUnauthorised() // 401
throw WebSocketForbidden()    // 403
```

Only a `$connect` does anything with the status code, where a non-2xx refuses the handshake. Nothing a
message handler returns reaches the client, so send data back with `postToConnection`.

```ts
import { postToConnection } from '@lambda-event-router/apigateway'

// domainName, stage and connectionId all come off the request
await postToConnection({ domainName, stage, connectionId, data: JSON.stringify({ content }) })
```

`WebSocketRouter` takes no middleware, at either level.

## Examples

See the [examples/apigateway](../../examples/apigateway) directory for complete working examples.

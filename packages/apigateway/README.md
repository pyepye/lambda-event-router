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

const apiRouter = createAPIGatewayRouter()

// Inline functions allows Typescript to automatic infer types
const updateItem = defineRoute({
  method: 'PUT',
  path: '/org/:orgId/items/:itemId/',
}).handle(async ({ path, body }) => {
  return { orgId: path.orgId, name: body.name, price: body.price };
})
apiRouter.route(updateItem)
```

OR use a the separate syntax  to split router and handlers across files:

```ts
// api.ts
import { createAPIGatewayRouter, defineRoute } from '@lambda-event-router/apigateway'

const apiRouter = createAPIGatewayRouter()

// Separate handler to define routes and handlers in different places
apiRouter.put({
  path: '/org/:orgId/items/:itemId/',
  handler: updateItem,
});

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function updateItem(
  request: ApiRequest<PathParams, QueryParams, Body>,
): Promise<ApiResponse<UpdateItemResponse>> {
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
  method: 'POST',
  path: '/orgs/:orgId/items/:itemId',
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
import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'

const apiRouter = createAPIGatewayRouter()

apiRouter.get({
  method: 'POST'
  path: '/orgs/:orgId/items/:itemId',
  handler: updateItem
})

export async function updateItem(
  request: ApiRequest<PathParams, QueryParams, Body>,
): Promise<ApiResponse<UpdateItemResponse>> {
  const item = await getItem(path.itemId);
  if (!item) {
    throw NotFound(`${path.itemId} not found`);
  }
  return { orgId: path.orgId, name: body.name, price: body.price }
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

#### Responses

```ts
return { data: ... } // By default this will resolve to a 200 with the body as JSON
return // By default this will resolve to a 204

return Ok(data)
return Created(data);
return NoContent();
// Throw none positive response (they can also be returned as well)
throw TemporaryRedirect(location);
throw PermanentRedirect(location);
throw BadRequest(errorMessage);
throw Unauthorised(errorMessage);
throw Forbidden(errorMessage);
throw NotFound(errorMessage);
throw Conflict(errorMessage);
throw UnprocessableContent(errorMessage);
throw InternalServerError(errorMessage);
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

### WebSocket

#### Inline handlers

```ts
import { createWebSocketRouter, defineWebSocketRoute, WebSocketOk } from '@lambda-event-router/apigateway'

const wsRouter = createWebSocketRouter()

wsRouter.route(
  defineWebSocketRoute({
    filters: { eventType: 'MESSAGE', routeKeys: ['sendMessage'] },
  }).handle(async ({ body, connectionId }) => {
    return WebSocketOk()
  })
)
```

#### Separate handlers
```ts
import { createWebSocketRouter } from '@lambda-event-router/apigateway'

const wsRouter = createWebSocketRouter()

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

async function onConnect({ connectionId, queryStringParameters }) {
  // Store connection
}

async function onDisconnect({ connectionId }) {
  // Remove connection
}

async function onSendMessage({ connectionId, body }) {
  // Handle message
}
```

#### Helper methods

```ts
wsRouter.connect()
wsRouter.disconnect()
wsRouter.message()
```

#### Responses

```ts
return WebSocketOk()          // 200
throw WebSocketUnauthorised() // 401
throw WebSocketForbidden()    // 403
```

## Examples

See the [examples/apigateway](../../examples/apigateway) directory for complete working examples.

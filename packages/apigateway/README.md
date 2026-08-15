# @lambda-event-router/apigateway

Routes API Gateway requests to handlers by method and path. REST APIs and both HTTP API payload versions give your handler the same request object. The package also has routers for Lambda authorizers and WebSocket APIs.

**Supported AWS Services:** `Amazon API Gateway`

**Available Routers:** `APIGatewayRouter` | `LambdaAuthorizerRouter` | `WebSocketRouter`

**Docs:** [APIGatewayRouter](https://pyepye.github.io/lambda-event-router/routers/APIGatewayRouter) | [LambdaAuthorizerRouter](https://pyepye.github.io/lambda-event-router/routers/LambdaAuthorizerRouter) | [WebSocketRouter](https://pyepye.github.io/lambda-event-router/routers/WebSocketRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/apigateway
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { apiRouter } from './api'
import { authRouter } from './authorizer'
import { wsRouter } from './websocket'

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter, authRouter, wsRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// api.ts
import { createAPIGatewayRouter, defineRoute } from '@lambda-event-router/apigateway'
import { z } from 'zod'

export const apiRouter = createAPIGatewayRouter()

const createOrder = defineRoute({
  filters: {
    method: 'POST',
    path: '/orgs/:orgId/orders',
  },
  bodySchema: z.object({ item: z.string(), quantity: z.number() }),
}).handle(async ({ path, body }) => {
  console.log(`Creating an order for ${body.quantity} ${body.item} in ${path.orgId}`)
  return { orgId: path.orgId, item: body.item }
})

apiRouter.route(createOrder)
```

```ts
// authorizer.ts
import { Allow, createLambdaAuthorizerRouter, defineLambdaAuthorizerRoute, Deny } from '@lambda-event-router/apigateway'

export const authRouter = createLambdaAuthorizerRouter()

const authoriseWrite = defineLambdaAuthorizerRoute({
  filters: {
    type: 'REQUEST',
    method: 'POST',
  },
}).handle(async ({ headers, resourceArn }) => {
  console.log(`Authorising ${resourceArn}`)
  return headers['x-api-key'] === 'valid-key' ? Allow('user-123', resourceArn) : Deny('anonymous', resourceArn)
})

authRouter.route(authoriseWrite)
```

```ts
// websocket.ts
import { createWebSocketRouter, defineWebSocketRoute } from '@lambda-event-router/apigateway'
import { z } from 'zod'

export const wsRouter = createWebSocketRouter()

const sendMessage = defineWebSocketRoute({
  filters: {
    eventType: 'MESSAGE',
    routeKey: 'sendMessage',
  },
  bodySchema: z.object({ action: z.literal('sendMessage'), content: z.string() }),
}).handle(async ({ connectionId, body }) => {
  console.log(`Message from ${connectionId}: ${body.content}`)
})

wsRouter.route(sendMessage)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/APIGatewayRouter#annotated-handlers).

## Documentation

- [APIGatewayRouter](https://pyepye.github.io/lambda-event-router/routers/APIGatewayRouter) covers every filter, schema validation, CORS
  and API Gateway event versions.
- [LambdaAuthorizerRouter](https://pyepye.github.io/lambda-event-router/routers/LambdaAuthorizerRouter) covers every filter, responses
  and middleware.
- [WebSocketRouter](https://pyepye.github.io/lambda-event-router/routers/WebSocketRouter) covers every filter, schema validation, responses
  and sending messages to a client.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/apigateway](../../service-examples/apigateway) for a deployable app.

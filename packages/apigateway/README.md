# @latcher/apigateway

Routes API Gateway requests to handlers by method and path. REST APIs and both HTTP API payload versions give your handler the same request object. The package also has matchers for Lambda authorizers and WebSocket APIs.

**Supported AWS Services:** `Amazon API Gateway`

**Available Matchers:** `APIGatewayMatcher` | `LambdaAuthorizerMatcher` | `WebSocketMatcher`

**Docs:** [APIGatewayMatcher](https://pyepye.github.io/latcher/matchers/APIGatewayMatcher) | [LambdaAuthorizerMatcher](https://pyepye.github.io/latcher/matchers/LambdaAuthorizerMatcher) | [WebSocketMatcher](https://pyepye.github.io/latcher/matchers/WebSocketMatcher)

## Install

```bash
npm install @latcher/base @latcher/apigateway
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { apiMatcher } from './api'
import { authMatcher } from './authorizer'
import { wsMatcher } from './websocket'

const latcher = new Latcher({
  matchers: [apiMatcher, authMatcher, wsMatcher],
})

export const handler = latcher.handler()
```

```ts
// api.ts
import { createAPIGatewayMatcher, defineRoute, lambdaAuth } from '@latcher/apigateway'
import { z } from 'zod'

export const apiMatcher = createAPIGatewayMatcher()

const createOrder = defineRoute({
  filters: {
    method: 'POST',
    path: '/orgs/:orgId/orders',
  },
  auth: lambdaAuth(),
  bodySchema: z.object({ item: z.string(), quantity: z.number() }),
}).handle(async ({ path, body, auth }) => {
  console.log(`${auth.principalId} is ordering ${body.quantity} ${body.item} in ${path.orgId}`)
  return { orgId: path.orgId, item: body.item }
})

apiMatcher.route(createOrder)
```

```ts
// authorizer.ts
import { Allow, createLambdaAuthorizerMatcher, defineLambdaAuthorizerRoute, Deny } from '@latcher/apigateway'

export const authMatcher = createLambdaAuthorizerMatcher()

const authoriseWrite = defineLambdaAuthorizerRoute({
  filters: {
    type: 'REQUEST',
    method: 'POST',
  },
}).handle(async ({ headers, resourceArn }) => {
  console.log(`Authorising ${resourceArn}`)
  return headers['x-api-key'] === 'valid-key' ? Allow('user-123', resourceArn) : Deny('anonymous', resourceArn)
})

authMatcher.route(authoriseWrite)
```

```ts
// websocket.ts
import { createWebSocketMatcher, defineWebSocketRoute } from '@latcher/apigateway'
import { z } from 'zod'

export const wsMatcher = createWebSocketMatcher()

const sendMessage = defineWebSocketRoute({
  filters: {
    eventType: 'MESSAGE',
    routeKey: 'sendMessage',
  },
  bodySchema: z.object({ action: z.literal('sendMessage'), content: z.string() }),
}).handle(async ({ connectionId, body }) => {
  console.log(`Message from ${connectionId}: ${body.content}`)
})

wsMatcher.route(sendMessage)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/APIGatewayMatcher#annotated-handlers).

## Documentation

- [APIGatewayMatcher](https://pyepye.github.io/latcher/matchers/APIGatewayMatcher) covers every filter, schema validation, auth,
  CORS and API Gateway event versions.
- [LambdaAuthorizerMatcher](https://pyepye.github.io/latcher/matchers/LambdaAuthorizerMatcher) covers every filter, responses
  and middleware.
- [WebSocketMatcher](https://pyepye.github.io/latcher/matchers/WebSocketMatcher) covers every filter, schema validation, responses
  and sending messages to a client.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/apigateway](../../service-examples/apigateway) for a deployable app.

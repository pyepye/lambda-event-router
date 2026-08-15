# @lambda-event-router/alb

Routes Application Load Balancer requests to handlers by method and path. Your handler returns a body, and the router builds the response the load balancer expects.

**Supported AWS Services:** `Application Load Balancer`

**Available Routers:** `ALBRouter`

**Docs:** [ALBRouter](https://pyepye.github.io/lambda-event-router/routers/ALBRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/alb
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { albRouter } from './alb'

const lambdaRouter = new LambdaRouter({
  routers: [albRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// alb.ts
import { createALBRouter, defineRoute } from '@lambda-event-router/alb'
import { z } from 'zod'

export const albRouter = createALBRouter()

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

albRouter.route(createOrder)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/ALBRouter#annotated-handlers).

## Documentation

- [ALBRouter](https://pyepye.github.io/lambda-event-router/routers/ALBRouter) covers every filter, schema validation, responses
  and CORS.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/alb](../../service-examples/alb) for a deployable app.

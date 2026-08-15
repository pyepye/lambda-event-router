# @lambda-event-router/eventbridge

Routes EventBridge events to handlers by source, detail type, account, Region or resource. Your handler gets the validated `detail` payload. Through CloudTrail it also covers AWS services that cannot trigger Lambda directly.

**Supported AWS Services:** `Amazon EventBridge`

**Available Routers:** `EventBridgeRouter`

**Docs:** [EventBridgeRouter](https://pyepye.github.io/lambda-event-router/routers/EventBridgeRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/eventbridge
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { eventBridgeRouter } from './eventbridge'

const lambdaRouter = new LambdaRouter({
  routers: [eventBridgeRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// eventbridge.ts
import { createEventBridgeRouter, defineRoute } from '@lambda-event-router/eventbridge'
import { z } from 'zod'

export const eventBridgeRouter = createEventBridgeRouter()

const orderCreated = defineRoute({
  filters: {
    source: 'myapp.orders',
    detailType: 'Order Created',
    account: '123456789012',
    region: 'eu-west-2',
    resource: 'arn:aws:events:eu-west-2:123456789012:event-bus/orders',
  },
  detailSchema: z.object({ orderId: z.string(), total: z.number() }),
}).handle(async ({ detail }) => {
  console.log(`Processing order ${detail.orderId} for ${detail.total}`)
})

eventBridgeRouter.route(orderCreated)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/EventBridgeRouter#annotated-handlers).

## Documentation

- [EventBridgeRouter](https://pyepye.github.io/lambda-event-router/routers/EventBridgeRouter) covers every filter, schema validation,
  typed detail for AWS events and failures and retries.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/eventbridge](../../service-examples/eventbridge) for a deployable app.

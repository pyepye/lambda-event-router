# @lambda-event-router/sns

Routes each SNS notification to a handler by topic, subject or message attribute. The router parses the message and converts its attributes before your handler runs.

**Supported AWS Services:** `Amazon SNS`

**Available Routers:** `SNSRouter`

**Docs:** [SNSRouter](https://pyepye.github.io/lambda-event-router/routers/SNSRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/sns
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { snsRouter } from './sns'

const lambdaRouter = new LambdaRouter({
  routers: [snsRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// sns.ts
import { createSNSRouter, defineRoute } from '@lambda-event-router/sns'
import { z } from 'zod'

export const snsRouter = createSNSRouter()

const orderCreated = defineRoute({
  filters: {
    topicArn: 'arn:aws:sns:eu-west-2:123456789012:orders',
    subject: 'Order created',
    messageAttributes: { Type: 'OrderCreated' },
  },
  bodySchema: z.object({ orderId: z.string(), total: z.number() }),
}).handle(async ({ body }) => {
  console.log(`Processing order ${body.orderId} for ${body.total}`)
})

snsRouter.route(orderCreated)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/SNSRouter#annotated-handlers).

## Documentation

- [SNSRouter](https://pyepye.github.io/lambda-event-router/routers/SNSRouter) covers every filter, message attribute types,
  schema validation and failures and retries.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/sns](../../service-examples/sns) for a deployable app.

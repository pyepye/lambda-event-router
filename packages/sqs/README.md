# @lambda-event-router/sqs

Routes each message in an SQS batch to a handler by queue or message attribute. The router parses and validates the body, and can report failed messages back to SQS.

**Supported AWS Services:** `Amazon SQS`

**Available Routers:** `SQSRouter`

**Docs:** [SQSRouter](https://pyepye.github.io/lambda-event-router/routers/SQSRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/sqs
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { sqsRouter } from './sqs'

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// sqs.ts
import { createSQSRouter, defineRoute } from '@lambda-event-router/sqs'
import { z } from 'zod'

export const sqsRouter = createSQSRouter()

const processOrder = defineRoute({
  filters: {
    eventSourceArn: 'arn:aws:sqs:eu-west-2:123456789012:orders',
    messageAttributes: { Type: 'ProcessOrder' },
  },
  bodySchema: z.object({ orderId: z.string(), total: z.number() }),
}).handle(async ({ body }) => {
  console.log(`Processing order ${body.orderId} for ${body.total}`)
})

sqsRouter.route(processOrder)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/SQSRouter#annotated-handlers).

## Documentation

- [SQSRouter](https://pyepye.github.io/lambda-event-router/routers/SQSRouter) covers every filter, schema validation, message attribute types
  and batch failure reporting.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/sqs](../../service-examples/sqs) for a deployable app.

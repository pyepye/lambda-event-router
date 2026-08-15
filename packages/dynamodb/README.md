# @lambda-event-router/dynamodb

Routes each record in a DynamoDB Streams batch to a handler by event name, table or key. The router converts the images to plain objects and validates them against your schemas.

**Supported AWS Services:** `Amazon DynamoDB`

**Available Routers:** `DynamoDBRouter`

**Docs:** [DynamoDBRouter](https://pyepye.github.io/lambda-event-router/routers/DynamoDBRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/dynamodb
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { dynamoDBRouter } from './dynamodb'

const lambdaRouter = new LambdaRouter({
  routers: [dynamoDBRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// dynamodb.ts
import { createDynamoDBRouter, defineRoute } from '@lambda-event-router/dynamodb'
import { z } from 'zod'

export const dynamoDBRouter = createDynamoDBRouter({
  keys: { partitionKey: 'pk', sortKey: 'sk' },
})

const OrderSchema = z.object({ orderId: z.string(), status: z.string() })

const orderChanged = defineRoute({
  filters: {
    eventName: 'MODIFY',
    eventSourceArn: 'arn:aws:dynamodb:eu-west-2:123456789012:table/orders/stream/2026-01-01T00:00:00.000',
    streamViewType: 'NEW_AND_OLD_IMAGES',
    partitionKey: /^ORDER#/,
    sortKey: 'DETAILS',
  },
  newImageSchema: OrderSchema,
  oldImageSchema: OrderSchema,
}).handle(async ({ newImage, oldImage }) => {
  console.log(`Order ${newImage.orderId} moved from ${oldImage.status} to ${newImage.status}`)
})

dynamoDBRouter.route(orderChanged)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/DynamoDBRouter#annotated-handlers).

## Documentation

- [DynamoDBRouter](https://pyepye.github.io/lambda-event-router/routers/DynamoDBRouter) covers every filter, schema validation, numbers, and failures and retries.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/dynamodb](../../service-examples/dynamodb) for a deployable app.

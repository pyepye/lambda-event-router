# @latcher/dynamodb

Routes each record in a DynamoDB Streams batch to a handler by event name, table or key. The matcher converts the images to plain objects and validates them against your schemas.

**Supported AWS Services:** `Amazon DynamoDB`

**Available Matchers:** `DynamoDBMatcher`

**Docs:** [DynamoDBMatcher](https://pyepye.github.io/latcher/matchers/DynamoDBMatcher)

## Install

```bash
npm install @latcher/base @latcher/dynamodb
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { dynamoDBMatcher } from './dynamodb'

const latcher = new Latcher({
  matchers: [dynamoDBMatcher],
})

export const handler = latcher.handler()
```

```ts
// dynamodb.ts
import { createDynamoDBMatcher, defineRoute } from '@latcher/dynamodb'
import { z } from 'zod'

export const dynamoDBMatcher = createDynamoDBMatcher({
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

dynamoDBMatcher.route(orderChanged)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/DynamoDBMatcher#annotated-handlers).

## Documentation

- [DynamoDBMatcher](https://pyepye.github.io/latcher/matchers/DynamoDBMatcher) covers every filter, schema validation, numbers, and failures and retries.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/dynamodb](../../service-examples/dynamodb) for a deployable app.

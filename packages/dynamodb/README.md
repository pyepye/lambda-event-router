# @lambda-event-router/dynamodb

Routes each record in a DynamoDB Streams batch to a handler by event name, table or key. The router converts the images to plain objects and validates them against your schemas.

**Supported AWS Services:** `Amazon DynamoDB`

**Available Routers:** `DynamoDBRouter`

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/dynamodb
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { dynamodbRouter } from './dynamodb'

const lambdaRouter = new LambdaRouter({
  routers: [dynamodbRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// dynamodb.ts
import { createDynamoDBRouter, defineRoute } from '@lambda-event-router/dynamodb'
import { z } from 'zod'

const dynamodbRouter = createDynamoDBRouter()

// An inferred handler takes its types from the route
const processNewOrder = defineRoute({
  filters: {
    eventName: 'INSERT',
    eventSourceArn: 'arn:aws:dynamodb:us-east-1:123456789:table/orders/stream/2024-01-01',
  },
  newImageSchema: z.object({ orderId: z.string(), customerId: z.string() }),
}).handle(async ({ newImage }) => {
  console.log(`New order: ${newImage.orderId} for ${newImage.customerId}`)
})
dynamodbRouter.route(processNewOrder)
```

Or use an annotated handler, which names its types rather than inferring them:

```ts
// dynamodb.ts
import { createDynamoDBRouter } from '@lambda-event-router/dynamodb'
import type { DynamoDBInsertRequest } from '@lambda-event-router/dynamodb'
import { z } from 'zod'

const NewOrderSchema = z.object({ orderId: z.string(), customerId: z.string() })
type NewOrder = z.infer<typeof NewOrderSchema>

const dynamodbRouter = createDynamoDBRouter()

dynamodbRouter.insert({
  filters: {
    eventSourceArn: 'arn:aws:dynamodb:us-east-1:123456789:table/orders/stream/2024-01-01',
  },
  newImageSchema: NewOrderSchema,
  handler: processNewOrder,
})

// An annotated handler names its own types
export async function processNewOrder({ newImage }: DynamoDBInsertRequest<Record<string, unknown>, NewOrder>) {
  console.log(`New order: ${newImage.orderId} for ${newImage.customerId}`)
}
```


## Usage

#### Inferred handlers

```ts
import { createDynamoDBRouter, defineRoute } from '@lambda-event-router/dynamodb'

const dynamodbRouter = createDynamoDBRouter()

const processNewOrder = defineRoute({
  filters: {
    eventName: 'INSERT',
    eventSourceArn: 'arn:aws:dynamodb:us-east-1:123456789:table/orders/stream/2024-01-01',
  },
  newImageSchema: NewOrderSchema,
}).handle(async ({ newImage }) => {
  console.log(`New order: ${newImage.orderId} for ${newImage.customerId}`)
})

dynamodbRouter.route(processNewOrder)
```

#### Annotated handlers

```ts
import { createDynamoDBRouter } from '@lambda-event-router/dynamodb'
import type { DynamoDBInsertRequest } from '@lambda-event-router/dynamodb'
import type { z } from 'zod'

type NewOrder = z.infer<typeof NewOrderSchema>

const dynamodbRouter = createDynamoDBRouter()

dynamodbRouter.insert({
  filters: {
    eventSourceArn: 'arn:aws:dynamodb:us-east-1:123456789:table/orders/stream/2024-01-01',
  },
  newImageSchema: NewOrderSchema,
  handler: processNewOrder,
})

async function processNewOrder({ newImage }: DynamoDBInsertRequest<Record<string, unknown>, NewOrder>) {
  console.log(`New order: ${newImage.orderId} for ${newImage.customerId}`)
}
```

#### Helper methods

```ts
dynamodbRouter.insert()
dynamodbRouter.modify()
dynamodbRouter.remove()
```

#### Event name filtering

```ts
// INSERT - newImage available
defineRoute({
  filters: { eventName: 'INSERT' },
  newImageSchema: NewOrderSchema,
}).handle(async ({ newImage }) => { ... })

// MODIFY - both newImage and oldImage available
defineRoute({
  filters: { eventName: 'MODIFY' },
  newImageSchema: OrderSchema,
  oldImageSchema: OrderSchema,
}).handle(async ({ newImage, oldImage }) => { ... })

// REMOVE - oldImage available
defineRoute({
  filters: { eventName: 'REMOVE' },
  oldImageSchema: OrderSchema,
}).handle(async ({ oldImage }) => { ... })
```

#### Filters

```ts
defineRoute({
  filters: {
    eventName: ['INSERT', 'MODIFY'],
    eventSourceArn: 'arn:aws:dynamodb:us-east-1:123456789:table/orders/stream/2024-01-01',
    custom: ({ newImage }) => newImage?.status === 'PENDING',
  },
})
```

#### Numbers

DynamoDB sends every number as text and holds more digits than a JS number does. A value a number holds
exactly reaches you as a number, and anything longer reaches you as the original text.

| Stored | You get |
| --- | --- |
| `42.5` | `42.5` |
| `123456789012345678901234567890` | `'123456789012345678901234567890'` |
| `123456789012345678.5` | `'123456789012345678.5'` |

Convert it in your schema if you need arithmetic on one.

#### Batch failure reporting

```ts
const dynamodbRouter = createDynamoDBRouter({ batchItemFailures: true })
```

## Examples

See the [service-examples/dynamodb](../../service-examples/dynamodb) directory for complete working examples.

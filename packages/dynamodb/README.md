# @lambda-event-router/dynamodb

DynamoDB Streams routing by event name (INSERT, MODIFY, REMOVE) with typed image schemas and batch failure support.

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

// Inline functions allows Typescript to automatic infer types
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

OR use a the separate syntax to split router and handlers across files:

```ts
// dynamodb.ts
import { createDynamoDBRouter } from '@lambda-event-router/dynamodb'

const dynamodbRouter = createDynamoDBRouter()

// Separate handler to define routes and handlers in different places
dynamodbRouter.insert({
  filters: {
    eventSourceArn: 'arn:aws:dynamodb:us-east-1:123456789:table/orders/stream/2024-01-01',
  },
  newImageSchema: NewOrderSchema,
  handler: processNewOrder,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processNewOrder({ newImage }) {
  console.log(`New order: ${newImage.orderId} for ${newImage.customerId}`)
}
```


## Usage

#### Inline handlers

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

#### Separate handlers

```ts
import { createDynamoDBRouter } from '@lambda-event-router/dynamodb'

const dynamodbRouter = createDynamoDBRouter()

dynamodbRouter.insert({
  filters: {
    eventSourceArn: 'arn:aws:dynamodb:us-east-1:123456789:table/orders/stream/2024-01-01',
  },
  newImageSchema: NewOrderSchema,
  handler: processNewOrder,
})

async function processNewOrder({ newImage }) {
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

#### Batch failure reporting

```ts
const dynamodbRouter = createDynamoDBRouter({ batchItemFailures: true })
```

## Examples

See the [examples/dynamodb](../../examples/dynamodb) directory for complete working examples.

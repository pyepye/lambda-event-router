# Quick start

A Lambda handling an SQS queue takes two files. Once that works, adding a second event source to the
same Lambda is one more router, which is the part worth being here for.

## Install

One package per event source your Lambda receives. `base` comes along as a dependency, so there is
nothing else to add.

```bash
npm install @lambda-event-router/sqs
```

A Lambda sitting behind an HTTP API and a queue takes two:

```bash
npm install @lambda-event-router/apigateway @lambda-event-router/sqs
```

If you are not sure which package you need, the [packages page](/packages) lists every AWS event source
we cover.

## Your first Lambda

### 1. Create a router and register a route

```ts
import { createSQSRouter } from '@lambda-event-router/sqs'
import { z } from 'zod'

import { orders } from '../services/orders.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

const OrderSchema = z.object({
  orderId: z.string(),
  quantity: z.number().int().positive(),
})

export const sqsRouter = createSQSRouter({ batchItemFailures: true })

sqsRouter.route({
  filters: {
    eventSourceArn: ORDER_QUEUE_ARN,
    messageAttributes: { type: 'OrderPlaced' },
  },
  bodySchema: OrderSchema,
  handler: async ({ body }) => {
    // body is typed from OrderSchema, with nothing to declare
    await orders.save({ orderId: body.orderId, quantity: body.quantity })
  },
})
```

Breaking that down:

1. `createSQSRouter` makes a router for one event source. `batchItemFailures: true` reports failing
   records individually so only those get redelivered
2. `filters` says which records this route takes, and every key has to match. This one only takes
   `OrderPlaced` messages off that queue, so a second route can filter on `OrderCancelled` and get its
   own handler. The keys come from the event source, and [routing](/docs/routing#filters) lists them
3. `bodySchema` parses the message JSON and validates it, then types `body` from the same schema. See
   [schema validation](/docs/routing#schema-validation) for which libraries work and what a failure does
4. SQS hands Lambda a batch of records. The router unpacks it and calls your handler once per record, so
   ten messages arriving together run it ten times and you write for one message rather than a loop.
   [Handlers](/docs/handlers#requests) covers everything else the request carries

### 2. Export the Lambda handler

```ts
import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { sqsRouter } from './routers/sqs.js'

const lambdaRouter = new LambdaRouter({ routers: [sqsRouter] })

export const handler: Handler = lambdaRouter.handler()
```

`LambdaRouter` is what AWS invokes. It works out which of its [routers](/docs/routers) owns each event
before any of your filters run, so nothing in your code has to sniff at the event shape.

Congratulations, that is a working Lambda. Point the queue at it and every message reaches your handler
already parsed, validated and typed.

## Multiple event sources

One `LambdaRouter` takes as many routers as you need, and each event reaches exactly one of them.
Matching happens twice: `LambdaRouter` picks the router from the shape of the event, then that router
picks the route from your filters.

- A `PUT /items/:itemId` request goes to `apiRouter`, then to the route filtering on that method and path
- A stream record with `eventName: 'INSERT'` goes to `dynamoRouter`, then to the route filtering on that
  event name and stream ARN

Adding the second router cannot change how the first one's events are routed, so the API behaves exactly
as it did before the stream existed.

Open a file: [api-handlers/putItem.ts](#multi-router:api-handlers/putItem.ts) |
[db-handlers/onItemInserted.ts](#multi-router:db-handlers/onItemInserted.ts) |
[api.ts](#multi-router:api.ts) |
[dynamodb.ts](#multi-router:dynamodb.ts) |
[index.ts](#multi-router:index.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { apiRouter } from './api.js'
import { dynamoRouter } from './dynamodb.js'

// Two event sources, one entry point
const lambdaRouter = new LambdaRouter({ routers: [apiRouter, dynamoRouter] })

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'api.ts',
    code: `import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'

import { putItem } from './api-handlers/putItem.js'
import { ItemSchema } from './schemas/item.js'

export const apiRouter = createAPIGatewayRouter()

apiRouter.route({
  filters: { method: 'PUT', path: '/items/:itemId' },
  bodySchema: ItemSchema,
  handler: putItem,
})`,
  },
  {
    path: 'dynamodb.ts',
    code: `import { createDynamoDBRouter } from '@lambda-event-router/dynamodb'

import { onItemInserted } from './db-handlers/onItemInserted.js'
import { ItemKeysSchema, ItemSchema } from './schemas/item.js'

const ITEM_STREAM_ARN = 'arn:aws:dynamodb:eu-west-2:123456789012:table/items/stream/2026-01-01T00:00:00.000'

export const dynamoRouter = createDynamoDBRouter({ batchItemFailures: true })

dynamoRouter.route({
  filters: { eventName: 'INSERT', eventSourceArn: ITEM_STREAM_ARN },
  keysSchema: ItemKeysSchema,
  newImageSchema: ItemSchema,
  handler: onItemInserted,
})`,
  },
  {
    path: 'api-handlers/putItem.ts',
    code: `import type { ApiRequest } from '@lambda-event-router/apigateway'

import { type Item, type ItemKeys } from '../schemas/item.js'
import { items } from '../services/items.js'

type PathParams = { itemId: string }
type StoredItem = Item & ItemKeys

// query is unknown because the route sets no querySchema
export async function putItem(
  request: ApiRequest<PathParams, unknown, Item>,
): Promise<StoredItem> {
  const { path, body } = request

  const item = { itemId: path.itemId, ...body }
  await items.put(item)

  return item
}`,
  },
  {
    path: 'db-handlers/onItemInserted.ts',
    code: `import type { DynamoDBInsertRequest, DynamoDBResponse } from '@lambda-event-router/dynamodb'

import { type Item, type ItemKeys } from '../schemas/item.js'
import { search } from '../services/search.js'

export async function onItemInserted(
  request: DynamoDBInsertRequest<ItemKeys, Item>,
): Promise<DynamoDBResponse> {
  const { keys, newImage } = request

  await search.index(keys.itemId, newImage)
}`,
  },
  {
    path: 'schemas/item.ts',
    code: `import { z } from 'zod'

export const ItemSchema = z.object({
  name: z.string(),
  price: z.number().positive(),
})

export const ItemKeysSchema = z.object({ itemId: z.string() })

// Derived from the schemas so the handlers and the validation cannot drift apart
export type Item = z.infer<typeof ItemSchema>
export type ItemKeys = z.infer<typeof ItemKeysSchema>`,
  },
  {
    path: 'package.json',
    lang: 'json',
    code: `{
  "name": "items-lambda",
  "type": "module",
  "dependencies": {
    "@lambda-event-router/apigateway": "^1.0.0",
    "@lambda-event-router/dynamodb": "^1.0.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.145",
    "typescript": "^5.9.0"
  }
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="multi-router" default-file="api-handlers/putItem.ts" line-numbers collapse-toggle fixed-height />

Both handlers above are plain functions with their request types named. Those types can be inferred from
the route's filters and schemas instead when using `defineRoute`, which puts the route definition in the
handler's file rather than the router's. See [handlers](/docs/handlers#inferred-handlers) for the same two
handlers written that way.

`ApiRequest` takes the path params, then the query params, then the body, and this route sets no
`querySchema` so its query is `unknown`. Returning the item on its own gives a 200 with the item as the
body, and the [response helpers](/docs/handlers#http-responses) cover the other status codes.

## Where next

| Page | What it covers |
| --- | --- |
| [Routers](/docs/routers) | What a router is, and what every one of them has in common |
| [Routing](/docs/routing) | Filter keys, `custom`, match order and where schemas go |
| [Handlers](/docs/handlers) | What a handler is given and what it may return |
| [Middleware](/docs/middleware) | Running code around your handlers |
| [Packages](/packages) | Every router, with a page each |

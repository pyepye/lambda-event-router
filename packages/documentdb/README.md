# @lambda-event-router/documentdb

Routes each change in a DocumentDB change stream batch to a handler by operation type. Your handler gets validated plain objects, one change at a time and in order.

**Supported AWS Services:** `Amazon DocumentDB`

**Available Routers:** `DocumentDBRouter`

**Docs:** [DocumentDBRouter](https://pyepye.github.io/lambda-event-router/routers/DocumentDBRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/documentdb
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { documentDBRouter } from './documentdb'

const lambdaRouter = new LambdaRouter({
  routers: [documentDBRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// documentdb.ts
import { createDocumentDBRouter, defineRoute } from '@lambda-event-router/documentdb'
import { z } from 'zod'

export const documentDBRouter = createDocumentDBRouter()

const OrderSchema = z.object({ status: z.string() })

const orderUpdated = defineRoute({
  filters: {
    operationType: 'update',
    eventSourceArn: 'arn:aws:rds:eu-west-2:123456789012:cluster:shop',
    database: 'shop',
    collection: 'orders',
    fullDocument: 'updateLookup',
    fullDocumentBeforeChange: 'whenAvailable',
  },
  fullDocumentSchema: OrderSchema,
  fullDocumentBeforeChangeSchema: OrderSchema,
}).handle(async ({ fullDocument, fullDocumentBeforeChange }) => {
  console.log(`Order was ${fullDocumentBeforeChange.status}, now ${fullDocument.status}`)
})

documentDBRouter.route(orderUpdated)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/DocumentDBRouter#annotated-handlers).

## Documentation

- [DocumentDBRouter](https://pyepye.github.io/lambda-event-router/routers/DocumentDBRouter) covers every filter, convenience methods, schema validation, and failures and retries.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/documentdb](../../service-examples/documentdb) for a deployable app.

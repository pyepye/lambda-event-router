# @lambda-event-router/documentdb

Routes each change in a DocumentDB change stream batch to a handler by operation type. Your handler gets validated plain objects, one change at a time and in order.

**Supported AWS Services:** `Amazon DocumentDB`

**Available Routers:** `DocumentDBRouter`

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/documentdb
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { documentdbRouter } from './documentdb'

const lambdaRouter = new LambdaRouter({
  routers: [documentdbRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// documentdb.ts
import { createDocumentDBRouter, defineRoute } from '@lambda-event-router/documentdb'
import { z } from 'zod'

const documentdbRouter = createDocumentDBRouter()

// An inferred handler takes its types from the route
const processNewOrder = defineRoute({
  filters: {
    operationType: 'insert',
    database: 'mydb',
    collection: 'orders',
  },
  fullDocumentSchema: z.object({ orderId: z.string(), total: z.number() }),
}).handle(async ({ fullDocument }) => {
  console.log(`New order: ${fullDocument.orderId}`)
})
documentdbRouter.route(processNewOrder)
```

Or use an annotated handler, which names its types rather than inferring them:

```ts
// documentdb.ts
import { createDocumentDBRouter } from '@lambda-event-router/documentdb'
import type { DocumentDBInsertRequest } from '@lambda-event-router/documentdb'
import { z } from 'zod'

const OrderSchema = z.object({ orderId: z.string(), total: z.number() })
type Order = z.infer<typeof OrderSchema>

const documentdbRouter = createDocumentDBRouter()

documentdbRouter.insert({
  filters: { database: 'mydb', collection: 'orders' },
  fullDocumentSchema: OrderSchema,
  handler: processNewOrder,
})

// An annotated handler names its own types
export async function processNewOrder({ fullDocument }: DocumentDBInsertRequest<Record<string, unknown>, Order>) {
  console.log(`New order: ${fullDocument.orderId}`)
}
```


## Usage

#### Inferred handlers

```ts
import { createDocumentDBRouter, defineRoute } from '@lambda-event-router/documentdb'

const documentdbRouter = createDocumentDBRouter()

const processNewOrder = defineRoute({
  filters: {
    operationType: 'insert',
    database: 'mydb',
    collection: 'orders',
  },
  fullDocumentSchema: OrderSchema,
}).handle(async ({ fullDocument }) => {
  console.log(`New order: ${fullDocument.orderId}`)
})

documentdbRouter.route(processNewOrder)
```

#### Annotated handlers

```ts
import { createDocumentDBRouter } from '@lambda-event-router/documentdb'
import type { DocumentDBInsertRequest } from '@lambda-event-router/documentdb'
import type { z } from 'zod'

type Order = z.infer<typeof OrderSchema>

const documentdbRouter = createDocumentDBRouter()

documentdbRouter.insert({
  filters: { database: 'mydb', collection: 'orders' },
  fullDocumentSchema: OrderSchema,
  handler: processNewOrder,
})

async function processNewOrder({ fullDocument }: DocumentDBInsertRequest<Record<string, unknown>, Order>) {
  console.log(`New order: ${fullDocument.orderId}`)
}
```

#### Helper methods

```ts
documentdbRouter.insert()
documentdbRouter.update()
documentdbRouter.replace()
documentdbRouter.delete()
```

#### Operation type filtering

```ts
// Insert - fullDocument available
defineRoute({
  filters: { operationType: 'insert' },
  fullDocumentSchema: OrderSchema,
}).handle(async ({ fullDocument }) => { ... })

// Update - fullDocument and updateDescription available
defineRoute({
  filters: { operationType: 'update' },
  fullDocumentSchema: OrderSchema,
}).handle(async ({ fullDocument, updateDescription }) => { ... })

// Delete
defineRoute({
  filters: { operationType: 'delete' },
}).handle(async ({ documentKey }) => { ... })
```

#### Filters

```ts
defineRoute({
  filters: {
    operationType: ['insert', 'update'],
    database: 'mydb',
    collection: ['orders', 'items'],
    custom: ({ event }) => event.updateDescription?.updatedFields?.status !== undefined,
  },
})
```

## Examples

See the [service-examples/documentdb](../../service-examples/documentdb) directory for complete working examples.

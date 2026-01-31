# @lambda-event-router/documentdb

DocumentDB Change Streams routing by operation type (insert, update, replace, delete) with typed document schemas.

**Supported AWS Services:** `Amazon DocumentDB`

**Available Routers:** `DocumentDBRouter`

## Install

```bash
npm install @lambda-event-router/documentdb
```


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

// Inline functions allows Typescript to automatic infer types
const processNewOrder = defineRoute({
  filters: {
    operationTypes: ['insert'],
    databases: ['mydb'],
    collections: ['orders'],
  },
  fullDocumentSchema: z.object({ orderId: z.string(), total: z.number() }),
}).handle(async ({ fullDocument }) => {
  console.log(`New order: ${fullDocument.orderId}`)
})
documentdbRouter.route(processNewOrder)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// documentdb.ts
import { createDocumentDBRouter } from '@lambda-event-router/documentdb'

const documentdbRouter = createDocumentDBRouter()

// Separate handler to define routes and handlers in different places
documentdbRouter.insert({
  filters: { databases: ['mydb'], collections: ['orders'] },
  fullDocumentSchema: OrderSchema,
  handler: processNewOrder,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processNewOrder({ fullDocument }) {
  console.log(`New order: ${fullDocument.orderId}`)
}
```


## Usage

#### Inline handlers

```ts
import { createDocumentDBRouter, defineRoute } from '@lambda-event-router/documentdb'

const documentdbRouter = createDocumentDBRouter()

const processNewOrder = defineRoute({
  filters: {
    operationTypes: ['insert'],
    databases: ['mydb'],
    collections: ['orders'],
  },
  fullDocumentSchema: OrderSchema,
}).handle(async ({ fullDocument }) => {
  console.log(`New order: ${fullDocument.orderId}`)
})

documentdbRouter.route(processNewOrder)
```

#### Separate handlers

```ts
import { createDocumentDBRouter } from '@lambda-event-router/documentdb'

const documentdbRouter = createDocumentDBRouter()

documentdbRouter.insert({
  filters: { databases: ['mydb'], collections: ['orders'] },
  fullDocumentSchema: OrderSchema,
  handler: processNewOrder,
})

async function processNewOrder({ fullDocument }) {
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
  filters: { operationTypes: ['insert'] },
  fullDocumentSchema: OrderSchema,
}).handle(async ({ fullDocument }) => { ... })

// Update - fullDocument and updateDescription available
defineRoute({
  filters: { operationTypes: ['update'] },
  fullDocumentSchema: OrderSchema,
}).handle(async ({ fullDocument, updateDescription }) => { ... })

// Delete
defineRoute({
  filters: { operationTypes: ['delete'] },
}).handle(async ({ documentKey }) => { ... })
```

#### Filters

```ts
defineRoute({
  filters: {
    operationTypes: ['insert', 'update'],
    databases: ['mydb'],
    collections: ['orders', 'items'],
    customFilter: ({ fullDocument }) => fullDocument?.status === 'ACTIVE',
  },
})
```

## Examples

See the [examples/documentdb](../../examples/documentdb) directory for complete working examples.

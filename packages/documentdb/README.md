# @latcher/documentdb

Routes each change in a DocumentDB change stream batch to a handler by operation type. Your handler gets validated plain objects, one change at a time and in order.

**Supported AWS Services:** `Amazon DocumentDB`

**Available Matchers:** `DocumentDBMatcher`

**Docs:** [DocumentDBMatcher](https://pyepye.github.io/latcher/matchers/DocumentDBMatcher)

## Install

```bash
npm install @latcher/base @latcher/documentdb
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { documentDBMatcher } from './documentdb'

const latcher = new Latcher({
  matchers: [documentDBMatcher],
})

export const handler = latcher.handler()
```

```ts
// documentdb.ts
import { createDocumentDBMatcher, defineRoute } from '@latcher/documentdb'
import { z } from 'zod'

export const documentDBMatcher = createDocumentDBMatcher()

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

documentDBMatcher.route(orderUpdated)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/DocumentDBMatcher#annotated-handlers).

## Documentation

- [DocumentDBMatcher](https://pyepye.github.io/latcher/matchers/DocumentDBMatcher) covers every filter, convenience methods, schema validation, and failures and retries.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/documentdb](../../service-examples/documentdb) for a deployable app.

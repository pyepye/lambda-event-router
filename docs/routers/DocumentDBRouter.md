# DocumentDBRouter

`DocumentDBRouter` routes Amazon DocumentDB change stream events to handlers, one change at a time.

A single event carries a batch of changes from one cluster, each describing an insert, update, replace
or delete on a collection. The router validates each change's document key and its documents, works out
which of your routes should handle it, then hands your handler plain objects. Changes run in the order
they arrive rather than in parallel, because a change stream is ordered.

## Install

```bash
npm install @lambda-event-router/documentdb
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

## Create the router

```ts
import { createDocumentDBRouter } from '@lambda-event-router/documentdb'
import { logInvocation } from './middleware/logInvocation'

const documentDBRouter = createDocumentDBRouter({
  middleware: [logInvocation],  // Optional
})
```

`createDocumentDBRouter()` on its own is a working router.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `DocumentDBMiddleware[]` | No | `[]` | Runs for every change this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
documentDBRouter.route({
  filters: {
    operationType: 'update',
    eventSourceArn: CLUSTER_ARN,
    database: 'ecommerce',
    collection: 'orders',
  },
  documentKeySchema: OrderDocumentKeySchema,  // Optional
  fullDocumentSchema: OrderSchema,  // Optional
  fullDocumentBeforeChangeSchema: OrderSchema,  // Optional
  middleware: [withOrderContext],  // Optional
  handler: onOrderUpdated,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
documentDBRouter.route(orderInsertedRoute).route(orderUpdatedRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A change that matches no route throws.** The router cannot report a single failure, so that throw
fails the invocation and every change behind it in the batch goes unprocessed. A change stream carries
all four operation types, so cover each one you care about and register a catch-all filtering only on
`eventSourceArn` for the rest. See [nothing matched](/docs/routing#nothing-matched) for what the other
routers do instead.

### Convenience methods

`insert()`, `update()`, `replace()` and `delete()` fill in the `operationType` filter and take
everything else exactly as `route()` does.

```ts
// Both of these register the same route
documentDBRouter.insert({
  filters: { eventSourceArn: CLUSTER_ARN, collection: 'orders' },
  handler: onOrderInserted,
})

documentDBRouter.route({
  filters: { operationType: 'insert', eventSourceArn: CLUSTER_ARN, collection: 'orders' },
  handler: onOrderInserted,
})
```

| Method | Sets | Schemas it takes |
| --- | --- | --- |
| `insert()` | `operationType: 'insert'` | `documentKeySchema`, `fullDocumentSchema` |
| `update()` | `operationType: 'update'` | `documentKeySchema`, `fullDocumentSchema`, `fullDocumentBeforeChangeSchema` |
| `replace()` | `operationType: 'replace'` | `documentKeySchema`, `fullDocumentSchema`, `fullDocumentBeforeChangeSchema` |
| `delete()` | `operationType: 'delete'` | `documentKeySchema`, `fullDocumentBeforeChangeSchema` |

Each method drops what it cannot use, so `insert()` rejects an `operationType` in its filters and a
`fullDocumentBeforeChangeSchema` outright, and `delete()` rejects a `fullDocumentSchema`. `route()`
still takes everything. See [convenience methods](/docs/routing#convenience-methods) for how the other
routers use them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the changes you want and leave the rest off.

```ts
documentDBRouter.route({
  filters: {
    operationType: ['update', 'replace'],
    eventSourceArn: CLUSTER_ARN,
    database: 'ecommerce', // Or a pattern: /^ecommerce/
    collection: ['orders', 'invoices'],
    fullDocument: 'updateLookup',
    fullDocumentBeforeChange: ['whenAvailable', 'required'],
    custom: ({ event }) => {
      // Only a custom reaches the raw change event
      if (!isObject(event.fullDocument) || typeof event.fullDocument.total !== 'number') return false

      return event.fullDocument.total >= HIGH_VALUE_THRESHOLD
    },
  },
  handler: onHighValueOrderChanged,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `operationType` | `DocumentDBOperationType \| readonly DocumentDBOperationType[]` | `insert`, `update`, `replace` or `delete`. The convenience methods set it for you |
| `eventSourceArn` | `FilterStringMatcher` | Matches against the ARN of the cluster the event came from |
| `database` | `FilterStringMatcher` | Matches the change's database name, `ns.db` |
| `collection` | `FilterStringMatcher` | Matches the change's collection name, `ns.coll` |
| `fullDocument` | `DocumentDBFullDocumentOption \| readonly DocumentDBFullDocumentOption[]` | `default`, `updateLookup`, `whenAvailable` or `required`. Types only, no matching |
| `fullDocumentBeforeChange` | `DocumentDBFullDocumentBeforeChangeOption \| readonly DocumentDBFullDocumentBeforeChangeOption[]` | `off`, `whenAvailable` or `required`. Types only, no matching |
| `custom` | `(input: DocumentDBFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Given `operationType`, `ns` and the raw `event`. Can be async |

DocumentDB spells its operation types in lower case, so `insert` rather than DynamoDB's `INSERT`.

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**`fullDocument` and `fullDocumentBeforeChange` match nothing.** The router never reads them when
picking a route. They name the settings your change stream was opened with, and what they do is tell
the types that those event fields will be populated, so an [inferred handler](#inferred-handlers) gets
them as required rather than optional. `default` and `off` are the settings that leave a field out, so
neither declares anything.

Set one on a route whose change stream is not configured that way and the field is typed as present but
arrives `undefined`.

**`custom` sees the raw change event before any schema has run**, so narrow `event.fullDocument`
with `isObject` from `@lambda-event-router/base` rather than reading straight into it. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { DocumentDBResponse, DocumentDBUpdateRequest } from '@lambda-event-router/documentdb'

export async function onOrderUpdated(
  request: DocumentDBUpdateRequest<OrderDocumentKey, Order>,
): Promise<DocumentDBResponse> {
  const { documentKey, updateDescription } = request
  const changed = Object.keys(updateDescription.updatedFields ?? {})
  logger.info(`Order ${documentKey._id} changed ${changed.join(', ')}`)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `operationType` | `'insert' \| 'update' \| 'replace' \| 'delete'` | Which change this is |
| `documentKey` | `TDocumentKey` | The changed document's `_id` |
| `fullDocument` | `TFullDocument` | The document after the change. Always on insert and replace, on update only when the change stream sends it, never on delete |
| `updateDescription` | `DocumentDBUpdateDescription` | `updatedFields` and `removedFields`. Update only |
| `fullDocumentBeforeChange` | `TFullDocumentBeforeChange` | The document before the change, on update, replace and delete, and only when the change stream sends it |
| `changeEvent` | `DocumentDBChangeEvent` | The untouched change event, for `clusterTime`, `ns` and anything else you need |
| `entry` | `DocumentDBEventEntry` | The batch entry wrapping that change event |
| `context` | `Context` | The Lambda context |

`Context` comes from `aws-lambda`. `DocumentDBChangeEvent` and `DocumentDBEventEntry` come from this
package, since `aws-lambda` carries no DocumentDB types.

`DocumentDBRequest` is the four change shapes as a union, discriminated on `operationType`, so checking
it narrows the documents to the ones that change carries. Filtering a route to one operation type gets
you the narrow type without the check, which [Inferred handlers](#inferred-handlers) covers.

**Open your change stream with the documents your routes read.** `fullDocument: 'updateLookup'` is what
puts the document on an update event, and a before-change document needs `fullDocumentBeforeChange` set
to `whenAvailable` or `required`. Without them the field arrives `undefined`, and a route carrying a
schema for it fails the change instead.

### Response type

`DocumentDBResponse` is `undefined`. There is nothing useful to return from a change stream event, so
handlers return `Promise<DocumentDBResponse>` and the router works out what to hand back to Lambda.

Throwing is how you signal failure. See [Failures and retries](#failures-and-retries) for what that
does to the rest of the batch.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineRoute` reads the schemas and hands your handler
a fully typed `documentKey`, `fullDocument` and `fullDocumentBeforeChange`, defaults and coercion
included, so `total` below is a `number` without you declaring that anywhere.

The filters feed the types as well. A route filtered to `update` gets `updateDescription` typed as
present, one filtered to `delete` will not let you pass a `fullDocumentSchema`, and the `fullDocument`
declaration is what makes `fullDocument` non-optional here.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/documentdb'
import { z } from 'zod'

const OrderDocumentKeySchema = z.object({ _id: z.string() })
const OrderSchema = z.object({ _id: z.string(), status: z.string(), total: z.coerce.number() })

export const orderUpdatedRoute = defineRoute({
  filters: {
    operationType: 'update',
    eventSourceArn: CLUSTER_ARN,
    collection: 'orders',
    fullDocument: 'updateLookup',
  },
  documentKeySchema: OrderDocumentKeySchema,
  fullDocumentSchema: OrderSchema,
}).handle(async ({ documentKey, fullDocument, updateDescription }) => {
  logger.info(`Order ${documentKey._id} is now ${fullDocument.status} at ${fullDocument.total}`)
  logger.info(`Fields removed: ${updateDescription.removedFields?.join(', ')}`)
})

documentDBRouter.route(orderUpdatedRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`DocumentDBUpdateRequest`](#generic-parameters) and your own types.

```ts
// handlers/onOrderUpdated.ts
import { logger } from '@lambda-event-router/base'
import type { DocumentDBResponse, DocumentDBUpdateRequest } from '@lambda-event-router/documentdb'
import { z } from 'zod'

export const OrderDocumentKeySchema = z.object({ _id: z.string() })
export const OrderSchema = z.object({ _id: z.string(), status: z.string() })

type OrderDocumentKey = z.infer<typeof OrderDocumentKeySchema>
type Order = z.infer<typeof OrderSchema>

export async function onOrderUpdated(
  request: DocumentDBUpdateRequest<OrderDocumentKey, Order>,
): Promise<DocumentDBResponse> {
  if (!request.fullDocument) return

  logger.info(`Order ${request.documentKey._id} is now ${request.fullDocument.status}`)
}
```

```ts
// documentdb.ts
import { createDocumentDBRouter } from '@lambda-event-router/documentdb'
import { onOrderUpdated, OrderDocumentKeySchema, OrderSchema } from './handlers/onOrderUpdated'

const documentDBRouter = createDocumentDBRouter()

documentDBRouter.update({
  filters: { eventSourceArn: CLUSTER_ARN, collection: 'orders', fullDocument: 'updateLookup' },
  documentKeySchema: OrderDocumentKeySchema,
  fullDocumentSchema: OrderSchema,
  handler: onOrderUpdated,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
Exporting the schemas from the handler file and attaching them to the route in the router file keeps
the type and the validation from drifting apart. See [annotated
handlers](/docs/handlers#annotated-handlers) for the worked version.

**The `fullDocument` filter does not reach an annotated handler.** Only `defineRoute` reads the filters
to build the request type, so `DocumentDBUpdateRequest` keeps `fullDocument` optional however the route
is filtered, which is why `onOrderUpdated` returns early above. Intersect it if you would rather assert
the change stream's configuration once at the boundary.

```ts
type OrderUpdateRequest = DocumentDBUpdateRequest<OrderDocumentKey, Order> & { fullDocument: Order }
```

## Schema validation

Three keys take a schema, and all of them are optional.

```ts
const OrderDocumentKeySchema = z.object({
  _id: z.string(),
})

const OrderSchema = z.object({
  _id: z.string(),
  status: z.enum(['pending', 'confirmed', 'shipped']),
  total: z.coerce.number(),
})

documentDBRouter.route({
  filters: { operationType: 'update', eventSourceArn: CLUSTER_ARN, collection: 'orders' },
  documentKeySchema: OrderDocumentKeySchema,
  fullDocumentSchema: OrderSchema,
  fullDocumentBeforeChangeSchema: OrderSchema,
  handler: onOrderUpdated,
})
```

| Key | Validates |
| --- | --- |
| `documentKeySchema` | The change's `documentKey` |
| `fullDocumentSchema` | The document after the change |
| `fullDocumentBeforeChangeSchema` | The document before the change |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so a change failing its schema throws rather than falling through to the next route. See
[schema validation](/docs/routing#schema-validation) for what your handler receives after coercion.

**A document schema still runs when the change carries no such document.** The router validates
`undefined`, which a `z.object()` rejects, so a route covering `['insert', 'update']` with a
`fullDocumentSchema` throws on every update it takes unless the change stream is on `updateLookup`.
Either split it into an `insert()` and an `update()` route, or make the schema optional.

```ts
fullDocumentSchema: OrderSchema.optional(),
```

## Failures and retries

Changes run one at a time in the order they arrive, and the first throw fails the invocation. Every
change behind it in the batch goes unprocessed, and Lambda redelivers the whole batch including the
changes that had already succeeded.

There is no way to report one change as failed and have the rest of the batch count as done. Lambda
does not offer partial batch responses on a DocumentDB source, so the router has nothing to hand back,
and a change that always throws holds up everything behind it on that stream. If you have used
`batchItemFailures` on the SQS or DynamoDB Streams routers, this is the source that has no equivalent.

Catching inside the handler is what keeps one bad change from blocking the rest. Where a failure needs
retrying rather than dropping, write the change onto a queue of your own and let that carry the retry.

## Middleware

Router and route middleware are both typed `DocumentDBMiddleware`, and the chain runs once per change,
so an event carrying ten changes runs it ten times.

```ts
import { logger } from '@lambda-event-router/base'
import type { DocumentDBMiddleware } from '@lambda-event-router/documentdb'

export const logInvocation: DocumentDBMiddleware = async (request, next) => {
  logger.info(`Handling ${request.operationType} on ${request.changeEvent.ns.coll}`)
  return next(request)
}

export const withOrderContext: DocumentDBMiddleware<OrderDocumentKey, Order> = async (request, next) => {
  logger.info(`Handling order ${request.documentKey._id}`)
  return next(request)
}
```

```ts
const documentDBRouter = createDocumentDBRouter({ middleware: [logInvocation] })

documentDBRouter.update({
  filters: { eventSourceArn: CLUSTER_ARN, collection: 'orders' },
  middleware: [withOrderContext],
  handler: onOrderUpdated,
})
```

**Route middleware carries the handler's types.** `onOrderUpdated` is annotated
`DocumentDBUpdateRequest<OrderDocumentKey, Order>`, so the route takes its middleware as
`DocumentDBMiddleware<OrderDocumentKey, Order>` and a plain `DocumentDBMiddleware` will not assign next
to it. A `defineRoute` route is the other way round: it takes the bare alias only, since the schemas on
their own do not narrow it.

`delete()` pins the middle generic to its default, so middleware on a delete route is
`DocumentDBMiddleware<OrderDocumentKey, Record<string, unknown>, Order>`. A deleted document has no
after image for the second parameter to type.

Changes are handled one at a time, so `appendKeys` on the shared logger cannot interleave the way it
does on SQS. Keys are cleared per invocation rather than per change, so one you set for a change stays
on every change after it in the same batch. See [middleware](/docs/middleware) for the execution order
and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/documentdb`.

| Type | Description |
| --- | --- |
| `DocumentDBRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>` | The handler argument, as a union of the four change shapes |
| `DocumentDBInsertRequest<TDocumentKey, TFullDocument>` | The insert branch, with `fullDocument` guaranteed |
| `DocumentDBUpdateRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>` | The update branch, with `updateDescription` guaranteed |
| `DocumentDBReplaceRequest<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>` | The replace branch, with `fullDocument` guaranteed |
| `DocumentDBDeleteRequest<TDocumentKey, TFullDocumentBeforeChange>` | The delete branch, with only `documentKey` guaranteed |
| `DocumentDBResponse` | Handler return type, `undefined` |
| `DocumentDBOperationType` | `'insert' \| 'update' \| 'replace' \| 'delete'` |
| `DocumentDBFullDocumentOption` | The change stream's `fullDocument` settings, `'default'` through `'required'` |
| `DocumentDBFullDocumentBeforeChangeOption` | The change stream's `fullDocumentBeforeChange` settings, `'off'` through `'required'` |
| `DocumentDBFilters` | The `filters` object |
| `DocumentDBFilterInput` | What `custom` receives |
| `DocumentDBRecordHandler<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>` | The `handler` function |
| `DocumentDBRouteDefinition<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>` | A full route passed to `route()` |
| `DocumentDBInsertRouteDefinition<TDocumentKey, TFullDocument>` | A route passed to `insert()` |
| `DocumentDBUpdateRouteDefinition<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>` | A route passed to `update()` |
| `DocumentDBReplaceRouteDefinition<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>` | A route passed to `replace()` |
| `DocumentDBDeleteRouteDefinition<TDocumentKey, TFullDocumentBeforeChange>` | A route passed to `delete()` |
| `DocumentDBRouterOptions` | Options for `createDocumentDBRouter` |
| `DocumentDBMiddleware<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>` | Router and route middleware |
| `DocumentDBUpdateDescription` | `request.updateDescription`, `{ updatedFields?, removedFields? }` |
| `DocumentDBChangeEvent` | `request.changeEvent`, the raw change from the stream |
| `DocumentDBEventEntry` | `request.entry`, the batch entry wrapping a change event |
| `DocumentDBEvent` | The whole event AWS invokes the Lambda with |

The `DocumentDBRouter` class and the `createDocumentDBRouter` and `defineRoute` functions come from the
same place.

### Generic parameters

Three parameters, though only the types covering a change that has both documents take all three.

| Types | Parameters |
| --- | --- |
| `DocumentDBRequest`, `DocumentDBUpdateRequest`, `DocumentDBReplaceRequest`, `DocumentDBRouteDefinition`, `DocumentDBUpdateRouteDefinition`, `DocumentDBReplaceRouteDefinition`, `DocumentDBMiddleware` | `<TDocumentKey, TFullDocument, TFullDocumentBeforeChange>` |
| `DocumentDBInsertRequest`, `DocumentDBInsertRouteDefinition` | `<TDocumentKey, TFullDocument>` |
| `DocumentDBDeleteRequest`, `DocumentDBDeleteRouteDefinition` | `<TDocumentKey, TFullDocumentBeforeChange>` |

| Parameter | Types | Default |
| --- | --- | --- |
| `TDocumentKey` | `request.documentKey` | `Record<string, unknown>` |
| `TFullDocument` | `request.fullDocument` | `Record<string, unknown>` |
| `TFullDocumentBeforeChange` | `request.fullDocumentBeforeChange` | `Record<string, unknown>` |

**On the delete types the second parameter is the before-change document.** A deleted document has no
after image, so `DocumentDBDeleteRequest<OrderDocumentKey, Order>` types `fullDocumentBeforeChange` as
`Order`.

Pass fewer than a type takes and the rest fall back to their defaults, so
`DocumentDBUpdateRequest<OrderDocumentKey>` types the document key and leaves both documents loose.

You only need these for [annotated handlers](#annotated-handlers). Inference covers all three.

## Code example

An orders collection on one cluster feeding one Lambda, with a route per operation type.

Open a file: [index.ts](#documentdb-example:index.ts) | [DocumentDB router](#documentdb-example:documentdb.ts) | [handlers](#documentdb-example:handlers/orders.ts) | [schema](#documentdb-example:schemas/order.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { documentDBRouter } from './documentdb.js'

const lambdaRouter = new LambdaRouter({
  routers: [documentDBRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'documentdb.ts',
    code: `import { createDocumentDBRouter } from '@lambda-event-router/documentdb'

import { onOrderDeleted, onOrderInserted, onOrderReplaced, onOrderUpdated } from './handlers/orders.js'
import { OrderDocumentKeySchema, OrderSchema } from './schemas/order.js'

const CLUSTER_ARN = 'arn:aws:rds:eu-west-2:123456789012:cluster:orders-docdb'
const ORDERS = { eventSourceArn: CLUSTER_ARN, database: 'ecommerce', collection: 'orders' }

export const documentDBRouter = createDocumentDBRouter()

documentDBRouter
  .insert({
    filters: ORDERS,
    documentKeySchema: OrderDocumentKeySchema,
    fullDocumentSchema: OrderSchema,
    handler: onOrderInserted,
  })
  .update({
    // The change stream is opened with fullDocument: 'updateLookup', so the document arrives too
    filters: { ...ORDERS, fullDocument: 'updateLookup' },
    documentKeySchema: OrderDocumentKeySchema,
    fullDocumentSchema: OrderSchema,
    handler: onOrderUpdated,
  })
  .replace({
    filters: ORDERS,
    documentKeySchema: OrderDocumentKeySchema,
    fullDocumentSchema: OrderSchema,
    handler: onOrderReplaced,
  })
  .delete({
    filters: ORDERS,
    documentKeySchema: OrderDocumentKeySchema,
    handler: onOrderDeleted,
  })`,
  },
  {
    path: 'handlers/orders.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type {
  DocumentDBDeleteRequest,
  DocumentDBInsertRequest,
  DocumentDBReplaceRequest,
  DocumentDBResponse,
  DocumentDBUpdateRequest,
} from '@lambda-event-router/documentdb'

import type { Order, OrderDocumentKey } from '../schemas/order.js'

export async function onOrderInserted(
  request: DocumentDBInsertRequest<OrderDocumentKey, Order>,
): Promise<DocumentDBResponse> {
  logger.info(\`Order created \${request.fullDocument._id} at \${request.fullDocument.total}\`)
}

export async function onOrderUpdated(
  request: DocumentDBUpdateRequest<OrderDocumentKey, Order>,
): Promise<DocumentDBResponse> {
  const { documentKey, fullDocument, updateDescription } = request
  const changed = Object.keys(updateDescription.updatedFields ?? {})
  logger.info(\`Order \${documentKey._id} changed \${changed.join(', ')}\`)

  if (fullDocument) {
    logger.info(\`Order \${documentKey._id} is now \${fullDocument.status}\`)
  }
}

export async function onOrderReplaced(
  request: DocumentDBReplaceRequest<OrderDocumentKey, Order>,
): Promise<DocumentDBResponse> {
  logger.info(\`Order replaced \${request.fullDocument._id}\`)
}

export async function onOrderDeleted(
  request: DocumentDBDeleteRequest<OrderDocumentKey>,
): Promise<DocumentDBResponse> {
  logger.info(\`Order deleted \${request.documentKey._id}\`)
}`,
  },
  {
    path: 'schemas/order.ts',
    code: `import { z } from 'zod'

export const OrderDocumentKeySchema = z.object({
  _id: z.string(),
})

export const OrderSchema = z.object({
  _id: z.string(),
  customerId: z.string(),
  status: z.enum(['pending', 'confirmed', 'shipped']),
  total: z.number(),
})

export type OrderDocumentKey = z.infer<typeof OrderDocumentKeySchema>
export type Order = z.infer<typeof OrderSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="documentdb-example" default-file="documentdb.ts" line-numbers collapse-toggle fixed-height />

Each route takes a different operation type, so no change can match more than one and the order you
register them in makes no difference. Between them they cover everything the stream sends, which is
what stops an unmatched change taking down the batch.

`onOrderUpdated` guards `fullDocument` even though the route declares `updateLookup`, because the
declaration only types a `defineRoute` handler. The delete route sets no document schemas at all, since
a delete carries nothing but the key unless the change stream is opened with
`fullDocumentBeforeChange`.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

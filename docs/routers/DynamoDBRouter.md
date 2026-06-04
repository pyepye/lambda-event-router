# DynamoDBRouter

`DynamoDBRouter` routes DynamoDB Streams records to handlers, one record at a time.

A single stream event can carry many records from the same table. The router unmarshalls each record's
keys and images out of DynamoDB's attribute value format, works out which of your routes should handle
it, then hands your handler plain objects. Records run in the order they arrive rather than in
parallel, because a stream shard is ordered.

## Install

```bash
npm install @lambda-event-router/dynamodb
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

## Create the router

```ts
import { createDynamoDBRouter } from '@lambda-event-router/dynamodb'
import { logInvocation } from './middleware/logInvocation'

const dynamoRouter = createDynamoDBRouter({
  batchItemFailures: true,  // Optional
  middleware: [logInvocation],  // Optional
  keys: { partitionKey: 'pk', sortKey: 'sk' },  // Optional
})
```

Every option can be left out. `createDynamoDBRouter()` on its own gives you a router that fails the
whole batch when any record throws.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `batchItemFailures` | `boolean` | No | `false` | Report failed records back to Lambda instead of failing the whole batch. See [Failures and retries](#failures-and-retries) |
| `middleware` | `DynamoDBMiddleware[]` | No | `[]` | Runs for every record this router handles, before any route middleware. See [Middleware](#middleware) |
| `keys` | `DynamoDBRouterKeys` | No | Not set | Names your table's partition and sort key attributes. Needed for the `partitionKey` and `sortKey` filters. See [Filters](#filters) |

## Register routes

```ts
dynamoRouter.route({
  filters: {
    eventName: 'MODIFY',
    eventSourceArn: ORDER_TABLE_STREAM_ARN,
  },
  keysSchema: OrderKeysSchema,  // Optional
  newImageSchema: OrderSchema,  // Optional
  oldImageSchema: OrderSchema,  // Optional
  middleware: [withOrderContext],  // Optional
  handler: onOrderChanged,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
dynamoRouter.route(orderInsertedRoute).route(orderChangedRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A record that matches no route throws.** With `batchItemFailures` off that fails the entire batch,
including records that would have succeeded. Register a catch-all route filtering only on
`eventSourceArn` if you would rather swallow unknown records, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

### Convenience methods

`insert()`, `modify()` and `remove()` fill in the `eventName` filter and take everything else exactly
as `route()` does.

```ts
// Both of these register the same route
dynamoRouter.insert({
  filters: { eventSourceArn: ORDER_TABLE_STREAM_ARN },
  handler: onOrderInserted,
})

dynamoRouter.route({
  filters: { eventName: 'INSERT', eventSourceArn: ORDER_TABLE_STREAM_ARN },
  handler: onOrderInserted,
})
```

| Method | Sets | Schemas it takes |
| --- | --- | --- |
| `insert()` | `eventName: 'INSERT'` | `keysSchema`, `newImageSchema` |
| `modify()` | `eventName: 'MODIFY'` | `keysSchema`, `newImageSchema`, `oldImageSchema` |
| `remove()` | `eventName: 'REMOVE'` | `keysSchema`, `oldImageSchema` |

Each method drops what it cannot use, so `insert()` rejects an `eventName` in its filters and an
`oldImageSchema` outright. `route()` still takes everything. See [convenience
methods](/docs/routing#convenience-methods) for how the other routers use them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the records you want and leave the rest off.

```ts
dynamoRouter.route({
  filters: {
    eventName: ['INSERT', 'MODIFY'],
    eventSourceArn: ORDER_TABLE_STREAM_ARN,
    streamViewType: 'NEW_AND_OLD_IMAGES',
    partitionKey: 'ORDER#123', // Or a pattern: /^ORDER#/
    sortKey: ['DETAILS', 'PAYMENT'],
    custom: ({ newImage, oldImage }) => {
      // Only a custom reaches the images or the raw record
      return newImage?.status !== oldImage?.status
    },
  },
  handler: onOrderChanged,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `eventName` | `DynamoDBEventName \| DynamoDBEventName[]` | `INSERT`, `MODIFY` or `REMOVE`. The convenience methods set it for you |
| `eventSourceArn` | `FilterStringMatcher` | Matches against the record's stream ARN |
| `streamViewType` | `DynamoDBViewType \| DynamoDBViewType[]` | `KEYS_ONLY`, `NEW_IMAGE`, `OLD_IMAGE` or `NEW_AND_OLD_IMAGES` |
| `partitionKey` | `FilterStringMatcher \| number \| Array<string \| number>` | Matches the value of your table's partition key |
| `sortKey` | `FilterStringMatcher \| number \| Array<string \| number>` | Matches the value of your table's sort key |
| `custom` | `(input: DynamoDBFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

Numeric key values are compared as numbers, so `partitionKey: 42` matches a key DynamoDB stores as `N`.

**Filtering on `partitionKey` or `sortKey` needs the router's `keys` option once your table has both.**
Without it the router reads the key name off the record, which only works when there is a single key
attribute, and throws `Cannot infer partitionKey/sortKey` otherwise.

```ts
const dynamoRouter = createDynamoDBRouter({ keys: { partitionKey: 'pk', sortKey: 'sk' } })
```

**`custom` sees the images before any schema has run**, so treat what is on them as unknown
rather than reading straight into it. See [`custom`](/docs/routing#custom) for where it
sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { DynamoDBModifyRequest, DynamoDBResponse } from '@lambda-event-router/dynamodb'

export async function onOrderChanged(
  request: DynamoDBModifyRequest<OrderKeys, Order, Order>,
): Promise<DynamoDBResponse> {
  const { newImage, oldImage } = request
  logger.info(`Order ${newImage.orderId} went from ${oldImage.status} to ${newImage.status}`)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `eventName` | `'INSERT' \| 'MODIFY' \| 'REMOVE'` | Which change the record describes |
| `keys` | `TKeys` | The record's key attributes, unmarshalled to plain values |
| `newImage` | `TNewItem` | The item after the change. On INSERT and MODIFY, `undefined` on REMOVE |
| `oldImage` | `TOldItem` | The item before the change. On MODIFY and REMOVE, `undefined` on INSERT |
| `record` | `DynamoDBRecord` | The untouched record from AWS, for `eventID`, `dynamodb.SequenceNumber` and anything else you need |
| `context` | `Context` | The Lambda context |

`DynamoDBRecord` and `Context` come from `aws-lambda`, not from this package.

`DynamoDBRequest` is the three event shapes as a union, discriminated on `eventName`, so checking it
narrows the images to the ones that event carries. Filtering a route to one event name gets you the
narrow type without the check, which [Inferred handlers](#inferred-handlers) covers.

**Set your stream's view type to match the images your routes read.** `NEW_AND_OLD_IMAGES` is the only
one carrying both. On a `KEYS_ONLY` stream every image arrives as `undefined` even where the types
promise one, and a route with an image schema fails the record instead.

### Response type

`DynamoDBResponse` is `undefined`. There is nothing useful to return from a stream record, so handlers
return `Promise<DynamoDBResponse>` and the router works out what to hand back to Lambda.

Throwing is how you signal failure. See [Failures and retries](#failures-and-retries) for what that
does to the rest of the batch.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineRoute` reads the schemas and hands your handler
a fully typed `keys`, `newImage` and `oldImage`, defaults and coercion included, so `total` below is a
`number` without you declaring that anywhere.

The `eventName` filter feeds the types as well. A route filtered to `MODIFY` gets both images typed as
present, and one filtered to `INSERT` will not let you pass an `oldImageSchema`.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/dynamodb'
import { z } from 'zod'

const OrderKeysSchema = z.object({ pk: z.string(), sk: z.string() })
const OrderSchema = z.object({ orderId: z.string(), status: z.string(), total: z.coerce.number() })

export const orderChangedRoute = defineRoute({
  filters: { eventName: 'MODIFY', eventSourceArn: ORDER_TABLE_STREAM_ARN },
  keysSchema: OrderKeysSchema,
  newImageSchema: OrderSchema,
  oldImageSchema: OrderSchema,
}).handle(async ({ keys, newImage, oldImage }) => {
  logger.info(`Order ${keys.pk} total is now ${newImage.total}, was ${oldImage.total}`)
})

dynamoRouter.route(orderChangedRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`DynamoDBModifyRequest`](#generic-parameters) and your own types.

```ts
// handlers/onOrderChanged.ts
import { logger } from '@lambda-event-router/base'
import type { DynamoDBModifyRequest, DynamoDBResponse } from '@lambda-event-router/dynamodb'
import { z } from 'zod'

export const OrderKeysSchema = z.object({ pk: z.string(), sk: z.string() })
export const OrderSchema = z.object({ orderId: z.string(), status: z.string() })

type OrderKeys = z.infer<typeof OrderKeysSchema>
type Order = z.infer<typeof OrderSchema>

export async function onOrderChanged(
  request: DynamoDBModifyRequest<OrderKeys, Order, Order>,
): Promise<DynamoDBResponse> {
  logger.info(`Order ${request.keys.pk} is now ${request.newImage.status}`)
}
```

```ts
// dynamodb.ts
import { createDynamoDBRouter } from '@lambda-event-router/dynamodb'
import { onOrderChanged, OrderKeysSchema, OrderSchema } from './handlers/onOrderChanged'

const dynamoRouter = createDynamoDBRouter()

dynamoRouter.modify({
  filters: { eventSourceArn: ORDER_TABLE_STREAM_ARN },
  keysSchema: OrderKeysSchema,
  newImageSchema: OrderSchema,
  oldImageSchema: OrderSchema,
  handler: onOrderChanged,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
Exporting the schemas from the handler file and attaching them to the route in the router file keeps
the type and the validation from drifting apart. See [annotated
handlers](/docs/handlers#annotated-handlers) for the worked version.

## Schema validation

Three keys take a schema, and all of them are optional.

```ts
const OrderKeysSchema = z.object({
  pk: z.string(),
  sk: z.string(),
})

const OrderSchema = z.object({
  orderId: z.string(),
  status: z.enum(['pending', 'confirmed', 'shipped']),
  total: z.coerce.number(),
})

dynamoRouter.route({
  filters: { eventName: 'MODIFY', eventSourceArn: ORDER_TABLE_STREAM_ARN },
  keysSchema: OrderKeysSchema,
  newImageSchema: OrderSchema,
  oldImageSchema: OrderSchema,
  handler: onOrderChanged,
})
```

| Key | Validates |
| --- | --- |
| `keysSchema` | The unmarshalled key attributes |
| `newImageSchema` | The unmarshalled new image |
| `oldImageSchema` | The unmarshalled old image |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so a record failing its schema throws rather than falling through to the next route. See
[schema validation](/docs/routing#schema-validation) for what your handler receives after coercion.

**An image schema fails every record that carries no such image.** A route covering
`['INSERT', 'MODIFY']` with an `oldImageSchema` set throws on each insert it takes, since an insert has
no old image to validate. Split it into an `insert()` and a `modify()` route, which only accept the
schemas their event can fill.

## Failures and retries

With `batchItemFailures` off, which is the default, records run one at a time in the order they arrive
and the first throw fails the invocation. Lambda retries the whole batch, and by default keeps retrying
that shard until the records succeed or age out, so a record that always throws holds up everything
behind it. `MaximumRetryAttempts` and a failure destination on the event source mapping are how you
bound that.

Turn it on and the router reports the failure back to Lambda instead.

```ts
const dynamoRouter = createDynamoDBRouter({ batchItemFailures: true })
```

**Reporting one failure reports every record after it too.** A shard is ordered, so the router stops at
the first throw and returns that record's `SequenceNumber` along with the `SequenceNumber` of every
record left in the batch. Lambda redelivers from the failed record onwards. This is the difference from
SQS, where records are independent and only the ones that threw come back.

You also need to set the `ReportBatchItemFailures` response type on the event source mapping. Without
it, AWS ignores what the router returns.

## Middleware

Router and route middleware are both typed `DynamoDBMiddleware`, and the chain runs once per record, so
a batch of ten records runs it ten times.

```ts
import { logger } from '@lambda-event-router/base'
import type { DynamoDBMiddleware } from '@lambda-event-router/dynamodb'

export const logInvocation: DynamoDBMiddleware = async (request, next) => {
  logger.info(`Handling ${request.eventName} on record ${request.record.eventID}`)
  return next(request)
}

export const withOrderContext: DynamoDBMiddleware<OrderKeys, Order, Order> = async (request, next) => {
  logger.info(`Handling order ${request.keys.pk}`)
  return next(request)
}
```

```ts
const dynamoRouter = createDynamoDBRouter({ middleware: [logInvocation] })

dynamoRouter.modify({
  filters: { eventSourceArn: ORDER_TABLE_STREAM_ARN },
  middleware: [withOrderContext],
  handler: onOrderChanged,
})
```

**Route middleware carries the handler's types.** `onOrderChanged` is annotated
`DynamoDBModifyRequest<OrderKeys, Order, Order>`, so the route takes its middleware as
`DynamoDBMiddleware<OrderKeys, Order, Order>` and a plain `DynamoDBMiddleware` will not assign next to
it. The bare alias is right everywhere else, on the router and on a `defineRoute` route, since the
schemas on their own do not narrow it.

Records are handled one at a time, so `appendKeys` on the shared logger cannot interleave the way it
does on SQS. Keys are cleared per invocation rather than per record, so one you set for a record stays
on every record after it in the same batch. See [middleware](/docs/middleware) for the execution order
and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/dynamodb`.

| Type | Description |
| --- | --- |
| `DynamoDBRequest<TKeys, TNewItem, TOldItem>` | The handler argument, as a union of the three event shapes |
| `DynamoDBInsertRequest<TKeys, TNewItem>` | The INSERT branch, with `newImage` guaranteed |
| `DynamoDBModifyRequest<TKeys, TNewItem, TOldItem>` | The MODIFY branch, with both images guaranteed |
| `DynamoDBRemoveRequest<TKeys, TOldItem>` | The REMOVE branch, with `oldImage` guaranteed |
| `DynamoDBResponse` | Handler return type, `undefined` |
| `DynamoDBEventName` | `'INSERT' \| 'MODIFY' \| 'REMOVE'` |
| `DynamoDBViewType` | The stream view types, `'KEYS_ONLY'` through `'NEW_AND_OLD_IMAGES'` |
| `DynamoDBFilters` | The `filters` object |
| `DynamoDBFilterInput` | What `custom` receives |
| `DynamoDBKeyValue` | A partition or sort key value, `string \| number` |
| `DynamoDBRecordHandler<TKeys, TNewItem, TOldItem>` | The `handler` function |
| `DynamoDBRouteDefinition<TKeys, TNewItem, TOldItem>` | A full route passed to `route()` |
| `DynamoDBInsertRouteDefinition<TKeys, TNewItem>` | A route passed to `insert()` |
| `DynamoDBModifyRouteDefinition<TKeys, TNewItem, TOldItem>` | A route passed to `modify()` |
| `DynamoDBRemoveRouteDefinition<TKeys, TOldItem>` | A route passed to `remove()` |
| `DynamoDBRouterOptions` | Options for `createDynamoDBRouter` |
| `DynamoDBRouterKeys` | The `keys` option, `{ partitionKey, sortKey? }` |
| `DynamoDBMiddleware<TKeys, TNewItem, TOldItem>` | Router and route middleware |

The `DynamoDBRouter` class and the `createDynamoDBRouter` and `defineRoute` functions come from the
same place.

### Generic parameters

Three parameters, though only the types covering every event take all three.

| Types | Parameters |
| --- | --- |
| `DynamoDBRequest`, `DynamoDBModifyRequest`, `DynamoDBRouteDefinition`, `DynamoDBModifyRouteDefinition`, `DynamoDBMiddleware` | `<TKeys, TNewItem, TOldItem>` |
| `DynamoDBInsertRequest`, `DynamoDBInsertRouteDefinition` | `<TKeys, TNewItem>` |
| `DynamoDBRemoveRequest`, `DynamoDBRemoveRouteDefinition` | `<TKeys, TOldItem>` |

| Parameter | Types | Default |
| --- | --- | --- |
| `TKeys` | `request.keys` | `Record<string, unknown>` |
| `TNewItem` | `request.newImage` | `Record<string, unknown>` |
| `TOldItem` | `request.oldImage` | `Record<string, unknown>` |

**On the REMOVE types the second parameter is the old image.** A removed record has no new image, so
`DynamoDBRemoveRequest<OrderKeys, Order>` types `oldImage` as `Order`.

Pass fewer than a type takes and the rest fall back to their defaults, so
`DynamoDBModifyRequest<OrderKeys>` types the keys and leaves both images loose.

You only need these for [annotated handlers](#annotated-handlers). Inference covers all three.

## Code example

An orders table stream feeding one Lambda, with a route per event name.

Open a file: [index.ts](#dynamodb-example:index.ts) | [DynamoDB router](#dynamodb-example:dynamodb.ts) | [handlers](#dynamodb-example:handlers/orders.ts) | [schema](#dynamodb-example:schemas/order.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { dynamoRouter } from './dynamodb.js'

const lambdaRouter = new LambdaRouter({
  routers: [dynamoRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'dynamodb.ts',
    code: `import { createDynamoDBRouter } from '@lambda-event-router/dynamodb'

import { onOrderInserted, onOrderRemoved, onOrderStatusChanged } from './handlers/orders.js'
import { OrderKeysSchema, OrderSchema } from './schemas/order.js'

const ORDER_TABLE_STREAM_ARN =
  'arn:aws:dynamodb:eu-west-2:123456789012:table/orders/stream/2026-01-01T00:00:00.000'

export const dynamoRouter = createDynamoDBRouter({
  batchItemFailures: true,
  keys: { partitionKey: 'pk', sortKey: 'sk' },
})

dynamoRouter
  .insert({
    filters: { eventSourceArn: ORDER_TABLE_STREAM_ARN, partitionKey: 'ORDER#*' },
    keysSchema: OrderKeysSchema,
    newImageSchema: OrderSchema,
    handler: onOrderInserted,
  })
  .modify({
    filters: { eventSourceArn: ORDER_TABLE_STREAM_ARN, partitionKey: 'ORDER#*' },
    keysSchema: OrderKeysSchema,
    newImageSchema: OrderSchema,
    oldImageSchema: OrderSchema,
    handler: onOrderStatusChanged,
  })
  .remove({
    filters: { eventSourceArn: ORDER_TABLE_STREAM_ARN, partitionKey: 'ORDER#*' },
    keysSchema: OrderKeysSchema,
    oldImageSchema: OrderSchema,
    handler: onOrderRemoved,
  })`,
  },
  {
    path: 'handlers/orders.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type {
  DynamoDBInsertRequest,
  DynamoDBModifyRequest,
  DynamoDBRemoveRequest,
  DynamoDBResponse,
} from '@lambda-event-router/dynamodb'

import type { Order, OrderKeys } from '../schemas/order.js'

export async function onOrderInserted(
  request: DynamoDBInsertRequest<OrderKeys, Order>,
): Promise<DynamoDBResponse> {
  logger.info(\`Order created \${request.newImage.orderId}\`)
}

export async function onOrderStatusChanged(
  request: DynamoDBModifyRequest<OrderKeys, Order, Order>,
): Promise<DynamoDBResponse> {
  const { newImage, oldImage } = request
  if (newImage.status === oldImage.status) return

  logger.info(\`Order \${newImage.orderId} moved to \${newImage.status}\`)
}

export async function onOrderRemoved(
  request: DynamoDBRemoveRequest<OrderKeys, Order>,
): Promise<DynamoDBResponse> {
  logger.info(\`Order deleted \${request.oldImage.orderId}\`)
}`,
  },
  {
    path: 'schemas/order.ts',
    code: `import { z } from 'zod'

export const OrderKeysSchema = z.object({
  pk: z.string(),
  sk: z.string(),
})

export const OrderSchema = z.object({
  orderId: z.string(),
  status: z.enum(['pending', 'confirmed', 'shipped']),
  total: z.number(),
})

export type OrderKeys = z.infer<typeof OrderKeysSchema>
export type Order = z.infer<typeof OrderSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="dynamodb-example" default-file="dynamodb.ts" line-numbers collapse-toggle fixed-height />

Each route takes a different event name, so no record can match more than one and the order you
register them in makes no difference. The `keys` option names `pk` and `sk` so the `partitionKey`
filter has something to read, and `ORDER#*` keeps these routes off the other entities sharing the
table.

`onOrderStatusChanged` returns early when the status has not moved. A `custom` comparing the two
images does the same job in the router, which is worth it when a route is expensive to enter.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

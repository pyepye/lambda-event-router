# KafkaRouter

`KafkaRouter` routes Apache Kafka messages to handlers, one record at a time. It takes both Amazon MSK
and self-managed clusters.

A single event can carry many records, spread across more than one topic and partition. The router
base64 decodes each record's key and value, parses the value as JSON, decodes the headers to text, then
works out which of your routes should handle it. Records run in the order they arrive rather than in
parallel, because a Kafka partition is ordered.

## Install

```bash
npm install @lambda-event-router/kafka
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

## Create the router

```ts
import { createKafkaRouter } from '@lambda-event-router/kafka'
import { logInvocation } from './middleware/logInvocation'

const kafkaRouter = createKafkaRouter({
  batchItemFailures: true,  // Optional
  middleware: [logInvocation],  // Optional
})
```

Both options can be left out. `createKafkaRouter()` on its own gives you a router that fails the whole
batch when any record throws.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `batchItemFailures` | `boolean` | No | `false` | Report failed records back to Lambda instead of failing the whole batch. See [Failures and retries](#failures-and-retries) |
| `middleware` | `KafkaMiddleware[]` | No | `[]` | Runs for every record this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
kafkaRouter.route({
  filters: {
    topic: STOCK_TOPIC,
    eventSourceArn: MSK_CLUSTER_ARN,
  },
  valueSchema: StockMovementSchema,  // Optional
  middleware: [withWarehouseContext],  // Optional
  handler: onStockMoved,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
kafkaRouter.route(stockMovedRoute).route(stockAlertRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A record that matches no route throws.** With `batchItemFailures` off that fails the entire batch,
including records that would have succeeded, so adding a topic to the event source mapping without
adding a route for it takes the whole invocation down. Register a catch-all route with empty `filters`
if you would rather swallow unknown records, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the records you want and leave the rest off.

```ts
kafkaRouter.route({
  filters: {
    topic: [STOCK_TOPIC, ALERT_TOPIC],
    eventSourceArn: MSK_CLUSTER_ARN,
    bootstrapServer: 'broker1.eu-west-2.example.com:9092', // Or a pattern: /^broker1\./
    custom: ({ headers }) => {
      // Only a custom reaches the headers, the key or the partition
      return headers.some((header) => header.source === 'warehouse-scanner')
    },
  },
  handler: onStockMoved,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `topic` | `FilterStringMatcher` | Matches the topic the record came from |
| `eventSourceArn` | `FilterStringMatcher` | Matches the MSK cluster ARN on the event. A self-managed event carries no ARN, so nothing from one matches this |
| `bootstrapServer` | `FilterStringMatcher` | Matches if any one of the event's brokers matches. AWS sends them as a comma separated list and the router splits it for you |
| `custom` | `(input: KafkaFilterInput) => boolean \| Promise<boolean>` | Anything the other keys cannot express, given the decoded `headers`, the `topic` and the raw `record`. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

The record key, the partition and the headers are all reachable through `custom` and nowhere
else. Headers arrive decoded, the partition is a plain number on `record`, and `record.key` is still
the base64 AWS sent, or missing entirely on a record published without one. See [Message
headers](#message-headers) for the shape `headers` takes.

**`custom` gets no parsed value.** The value is only decoded and validated once a route has
matched, so route on the contents by decoding `record.value` yourself. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { KafkaRequest, KafkaResponse } from '@lambda-event-router/kafka'

export async function onStockMoved(
  request: KafkaRequest<StockMovement>,
): Promise<KafkaResponse> {
  const { sku, quantity } = request.value
  logger.info(`Moved ${quantity} of ${sku} at offset ${request.offset}`)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `value` | `TValue` | The record value, base64 decoded and JSON parsed. A value that is not valid JSON reaches you as the decoded string, and a record carrying no value at all as `undefined` |
| `key` | `string \| undefined` | The record key, base64 decoded to text. Kafka partitions on this, so every record with the same key lands on the same partition. A producer can publish without a key, and then this is `undefined` and the broker spreads those records round robin |
| `topic` | `string` | The topic the record came from |
| `partition` | `number` | The partition within that topic |
| `offset` | `number` | Where the record sits in its partition. Unique per partition and increasing, so it makes a good idempotency key |
| `timestamp` | `number` | A Unix timestamp in milliseconds. `record.timestampType` says whether the producer or the broker set it |
| `headers` | `KafkaDecodedHeader[]` | The record headers with their values decoded to text, or an empty list where the record carries none. See [Message headers](#message-headers) |
| `record` | `KafkaRecord` | The untouched record from AWS, so `key` and `value` are still base64 |
| `context` | `Context` | The Lambda context |

`KafkaRecord` is this package's alias for `MSKRecord | SelfManagedKafkaRecord`, both of which come from
`aws-lambda` along with `Context`. `KafkaDecodedHeader` is declared by this package.

The two record types are identical, so nothing in a handler has to know which cluster it is reading
from. Only `eventSourceArn` differs, and that sits on the event rather than the record.

### Response type

`KafkaResponse` is `undefined`. There is nothing useful to return from a Kafka record, so handlers
return `Promise<KafkaResponse>` and the router works out what to hand back to Lambda.

Throwing is how you signal failure. See [Failures and retries](#failures-and-retries) for what that
does to the rest of the batch.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineRoute` reads the schema and hands your handler a
fully typed `value`, defaults and coercion included, so `quantity` below is a `number` and `damaged` a
`boolean` without you declaring either.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/kafka'
import { z } from 'zod'

const StockMovementSchema = z.object({
  sku: z.string(),
  quantity: z.coerce.number(),
  damaged: z.coerce.boolean().default(false),
})

export const stockMovedRoute = defineRoute({
  filters: { topic: STOCK_TOPIC },
  valueSchema: StockMovementSchema,
}).handle(async ({ value, key, offset }) => {
  if (value.damaged) return
  logger.info(`Moved ${value.quantity} of ${value.sku} under key ${key} at offset ${offset}`)
})

kafkaRouter.route(stockMovedRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`KafkaRequest`](#generic-parameters) and your own types.

```ts
// handlers/onStockMoved.ts
import { logger } from '@lambda-event-router/base'
import type { KafkaRequest, KafkaResponse } from '@lambda-event-router/kafka'
import { z } from 'zod'

export const StockMovementSchema = z.object({ sku: z.string(), quantity: z.number() })
type StockMovement = z.infer<typeof StockMovementSchema>

export async function onStockMoved(request: KafkaRequest<StockMovement>): Promise<KafkaResponse> {
  logger.info(`Moved ${request.value.quantity} of ${request.value.sku}`)
}
```

```ts
// kafka.ts
import { createKafkaRouter } from '@lambda-event-router/kafka'
import { onStockMoved, StockMovementSchema } from './handlers/onStockMoved'

const kafkaRouter = createKafkaRouter()

kafkaRouter.route({
  filters: { topic: STOCK_TOPIC },
  valueSchema: StockMovementSchema,
  handler: onStockMoved,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
Exporting the schema from the handler file and attaching it to the route in the router file keeps the
type and the validation from drifting apart. See [annotated
handlers](/docs/handlers#annotated-handlers) for the worked version.

## Schema validation

`valueSchema` is the only key that takes a schema, and it is optional.

```ts
const StockMovementSchema = z.object({
  sku: z.string(),
  quantity: z.coerce.number(),
  movedAt: z.coerce.date(),
})

kafkaRouter.route({
  filters: { topic: STOCK_TOPIC },
  valueSchema: StockMovementSchema,
  handler: onStockMoved,
})
```

| Key | Validates |
| --- | --- |
| `valueSchema` | The decoded, parsed record value |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so a record failing its schema throws rather than falling through to the next route. See
[schema validation](/docs/routing#schema-validation) for what your handler receives after coercion.

**An object schema fails every record whose value is not JSON.** A producer writing Avro, Protobuf or
plain text gets the decoded string through instead, which a `z.object()` rejects. Validate those with
`z.string()` and decode in the handler, or leave the schema off.

A record carrying no value fails the same way, since the schema is handed `undefined`. Make the schema
optional where that is something your producers send.

Nothing validates the key or the headers, so treat both as untrusted and the key as possibly absent.

## Failures and retries

With `batchItemFailures` off, which is the default, records run one at a time in the order they arrive
and the first throw fails the invocation. Lambda retries the whole batch, and both
`MaximumRetryAttempts` and `MaximumRecordAgeInSeconds` default to infinite, so a record that always
throws holds up everything behind it. Set those on the event source mapping, or give it an on-failure
destination, to bound that. `BisectBatchOnFunctionError` splits a failing batch in two and retries each
half, which narrows down which record is the problem.

Turn it on and the router reports the failure back to Lambda instead.

```ts
const kafkaRouter = createKafkaRouter({ batchItemFailures: true })
```

**Reporting one failure reports every record after it in the same partition.** A partition is ordered,
so the router stops that partition at the first throw and returns the failing record along with every
record left in it. Lambda redelivers that partition from the failed record onwards.

A batch can carry several partitions and the router handles each on its own, so a throw in one holds
back only that partition. Records on a partition that succeeds end to end are neither reported nor
redelivered.

Each failure Lambda gets back is an object rather than a plain id, pairing the `topic-partition` with
the offset. `KafkaBatchResponse` is the shape the router hands back.

```json
{
  "batchItemFailures": [
    { "itemIdentifier": { "partition": "stock-movements-0", "offset": 4218 } }
  ]
}
```

You also need to set the `ReportBatchItemFailures` response type on the event source mapping. Without
it, AWS ignores what the router returns.

## Middleware

Router and route middleware are both typed `KafkaMiddleware`, and the chain runs once per record, so a
batch of ten records runs it ten times.

```ts
import { logger } from '@lambda-event-router/base'
import type { KafkaMiddleware } from '@lambda-event-router/kafka'

export const logInvocation: KafkaMiddleware = async (request, next) => {
  logger.info(`Handling ${request.topic}-${request.partition} at offset ${request.offset}`)
  return next(request)
}

export const withWarehouseContext: KafkaMiddleware<StockMovement> = async (request, next) => {
  logger.info(`Handling movement of ${request.value.sku}`)
  return next(request)
}
```

```ts
const kafkaRouter = createKafkaRouter({ middleware: [logInvocation] })

kafkaRouter.route({
  filters: { topic: STOCK_TOPIC },
  valueSchema: StockMovementSchema,
  middleware: [withWarehouseContext],
  handler: onStockMoved,
})
```

**Route middleware carries the handler's value type.** An annotated handler narrows the route to
`KafkaMiddleware<StockMovement>` and a plain `KafkaMiddleware` will not assign next to it. The bare
alias is the right one on the router, and the only one that assigns on a `defineRoute` route, since
`defineRoute` does not thread the value type through to its middleware.

Records are handled one at a time, so `appendKeys` on the shared logger cannot interleave the way it
does on SQS. Keys are cleared per invocation rather than per record, so one you set for a record stays
on every record after it in the same batch. See [middleware](/docs/middleware) for the execution order
and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/kafka`.

| Type | Description |
| --- | --- |
| `KafkaRequest<TValue>` | The handler argument |
| `KafkaResponse` | Handler return type, `undefined` |
| `KafkaFilters` | The `filters` object |
| `KafkaFilterInput` | What `custom` receives |
| `KafkaRouteDefinition<TValue>` | A full route passed to `route()` |
| `KafkaRouterOptions` | Options for `createKafkaRouter` |
| `KafkaMiddleware<TValue>` | Router and route middleware |
| `KafkaDecodedHeader` | One decoded header entry, `Record<string, string>` |
| `KafkaBatchResponse` | What the router returns with `batchItemFailures` on |
| `KafkaBatchItemIdentifier` | One failed record, `{ partition, offset }` |
| `KafkaRecord` | Alias for `MSKRecord \| SelfManagedKafkaRecord` |
| `KafkaEvent` | Alias for `MSKEvent \| SelfManagedKafkaEvent` |

The `KafkaRouter` class and the `createKafkaRouter` and `defineRoute` functions come from the same
place.

### Generic parameters

The three types above that take a parameter take the same one.

| Parameter | Types | Default |
| --- | --- | --- |
| `TValue` | `request.value` | `unknown` |

Leave it off and `value` is `unknown`, so `KafkaRequest` on its own is the right annotation for
middleware that only reads the topic, the offset or the headers.

You only need this for [annotated handlers](#annotated-handlers). Inference covers it.

## Message headers

Kafka lets a producer attach any number of headers to a record, and it sends the values as bytes rather
than text. AWS passes them through as a list, one object per header, whose single key is the header
name, and leaves the field off a record with no headers at all.

The router decodes every value to UTF-8 and gives you an empty list where there were none, so `headers`
is always a list of `Record<string, string>`. Reading one means finding the entry that carries it.

```ts
import type { KafkaDecodedHeader } from '@lambda-event-router/kafka'

export function readHeader(headers: KafkaDecodedHeader[], name: string): string | undefined {
  return headers.find((header) => name in header)?.[name]
}
```

The list is a list because Kafka allows the same header name twice, which is how a producer sends
repeated values under one name. `find` gives you the first, and there is nothing clever to reach for if
you want them all.

Headers are the one piece of record metadata with no filter key of its own, so a `custom` is
where a route picks on them.

```ts
kafkaRouter.route({
  filters: {
    topic: STOCK_TOPIC,
    custom: ({ headers }) => headers.some((header) => header.source === 'warehouse-scanner'),
  },
  handler: onScannedMovement,
})
```

## Code example

A stock movements topic and a stock alerts topic on one MSK cluster, feeding a single Lambda.

Open a file: [index.ts](#kafka-example:index.ts) | [Kafka router](#kafka-example:kafka.ts) | [handlers](#kafka-example:handlers/stock.ts) | [schemas](#kafka-example:schemas/stock.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { kafkaRouter } from './kafka.js'

const lambdaRouter = new LambdaRouter({
  routers: [kafkaRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'kafka.ts',
    code: `import { createKafkaRouter } from '@lambda-event-router/kafka'

import { onStockAlert, onStockMoved } from './handlers/stock.js'
import { StockAlertSchema, StockMovementSchema } from './schemas/stock.js'

const MSK_CLUSTER_ARN = 'arn:aws:kafka:eu-west-2:123456789012:cluster/warehouse/abc-123-4'

const STOCK_TOPIC = 'stock-movements'
const ALERT_TOPIC = 'stock-alerts'

export const kafkaRouter = createKafkaRouter({ batchItemFailures: true })

kafkaRouter
  .route({
    filters: { topic: STOCK_TOPIC, eventSourceArn: MSK_CLUSTER_ARN },
    valueSchema: StockMovementSchema,
    handler: onStockMoved,
  })
  .route({
    filters: { topic: ALERT_TOPIC, eventSourceArn: MSK_CLUSTER_ARN },
    valueSchema: StockAlertSchema,
    handler: onStockAlert,
  })`,
  },
  {
    path: 'handlers/stock.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { KafkaRequest, KafkaResponse } from '@lambda-event-router/kafka'

import type { StockAlert, StockMovement } from '../schemas/stock.js'

export async function onStockMoved(
  request: KafkaRequest<StockMovement>,
): Promise<KafkaResponse> {
  const { sku, quantity, warehouse } = request.value
  logger.info(\`Moved \${quantity} of \${sku} in \${warehouse} at offset \${request.offset}\`)
}

export async function onStockAlert(request: KafkaRequest<StockAlert>): Promise<KafkaResponse> {
  const { sku, remaining, threshold } = request.value
  if (remaining > threshold) return

  logger.info(\`Stock of \${sku} is down to \${remaining}, below its threshold of \${threshold}\`)
}`,
  },
  {
    path: 'schemas/stock.ts',
    code: `import { z } from 'zod'

export const StockMovementSchema = z.object({
  sku: z.string(),
  quantity: z.coerce.number(),
  warehouse: z.string(),
  movedAt: z.coerce.date(),
})

export const StockAlertSchema = z.object({
  sku: z.string(),
  remaining: z.coerce.number(),
  threshold: z.coerce.number(),
})

export type StockMovement = z.infer<typeof StockMovementSchema>
export type StockAlert = z.infer<typeof StockAlertSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="kafka-example" default-file="kafka.ts" line-numbers collapse-toggle fixed-height />

A record comes from one topic, so the two `topic` filters cannot both match and the order you register
them in makes no difference. Point the event source mapping at a third topic without adding a route for
it and every batch carrying one throws, so the two need to keep pace with each other.

`onStockAlert` returns early when there is plenty left. A `custom` cannot do that job here, since
it never sees the parsed value.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

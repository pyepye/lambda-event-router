# KinesisRouter

`KinesisRouter` routes Amazon Kinesis Data Streams records to handlers, one record at a time.

A single event can carry many records from one or more streams. The router base64 decodes each record's
data, parses it as JSON, then works out which of your routes should handle it. Records run in the order
they arrive rather than in parallel, because a shard is ordered.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/kinesis
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createKinesisRouter } from '@lambda-event-router/kinesis'
import { logInvocation } from './middleware/logInvocation'

const kinesisRouter = createKinesisRouter({
  batchItemFailures: true,  // Optional
  middleware: [logInvocation],  // Optional
})
```

Both options can be left out. `createKinesisRouter()` on its own gives you a router that fails the
whole batch when any record throws.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `batchItemFailures` | `boolean` | No | `false` | Report failed records back to Lambda instead of failing the whole batch. See [Failures and retries](#failures-and-retries) |
| `middleware` | `KinesisMiddleware[]` | No | `[]` | Runs for every record this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
kinesisRouter.route({
  filters: {
    eventSourceArn: TELEMETRY_STREAM_ARN,
    partitionKey: 'sensor-42',
  },
  dataSchema: ReadingSchema,  // Optional
  middleware: [withDeviceContext],  // Optional
  handler: onReading,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
kinesisRouter.route(readingRoute).route(statusRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A record that matches no route throws.** With `batchItemFailures` off that fails the entire batch,
including records that would have succeeded. Register a catch-all route filtering only on
`eventSourceArn` if you would rather swallow unknown records, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the records you want and leave the rest off.

```ts
kinesisRouter.route({
  filters: {
    eventSourceArn: [TELEMETRY_STREAM_ARN, STATUS_STREAM_ARN],
    partitionKey: 'sensor-42', // Or a pattern: /^sensor-/
    custom: ({ data }) => {
      // Only a custom reaches the decoded data
      if (!isObject(data) || typeof data.celsius !== 'number') return false

      return data.celsius >= ALERT_THRESHOLD
    },
  },
  handler: onReading,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `eventSourceArn` | `FilterStringMatcher` | Matches against the record's stream ARN |
| `partitionKey` | `FilterStringMatcher` | Matches the partition key the producer wrote the record under |
| `custom` | `(input: KinesisFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

A partition key is whatever the producer chose, so it only tells routes apart if your producers agree
on a convention. Prefixing by record type gives you `sensor-42` and `gateway-7` to filter on, and a
route per prefix.

**`custom` sees the data before any schema has run**, so narrow it with `isObject` from
`@lambda-event-router/base` rather than reading straight into it. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { KinesisRequest, KinesisResponse } from '@lambda-event-router/kinesis'

export async function onReading(request: KinesisRequest<Reading>): Promise<KinesisResponse> {
  const { deviceId, celsius } = request.data
  logger.info(`Device ${deviceId} reported ${celsius}C at ${request.sequenceNumber}`)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `data` | `TData` | The record's data, base64 decoded and JSON parsed. If it is not valid JSON you get the decoded string |
| `partitionKey` | `string` | The partition key the producer wrote the record under, which is what Kinesis shards on |
| `sequenceNumber` | `string` | Where the record sits in its shard. Unique per shard and increasing, so it makes a good idempotency key |
| `approximateArrivalTimestamp` | `number` | When Kinesis accepted the record, as a Unix timestamp in seconds |
| `record` | `KinesisStreamRecord` | The untouched record from AWS, for `eventID`, `invokeIdentityArn` and anything else you need |
| `context` | `Context` | The Lambda context |

`KinesisStreamRecord` and `Context` come from `aws-lambda`, not from this package.

### Response type

`KinesisResponse` is `undefined`. There is nothing useful to return from a stream record, so handlers
return `Promise<KinesisResponse>` and the router works out what to hand back to Lambda.

Throwing is how you signal failure. See [Failures and retries](#failures-and-retries) for what that
does to the rest of the batch.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineRoute` reads the schema and hands your handler a
fully typed `data`, defaults and coercion included, so `celsius` below is a `number` and `calibrated` a
`boolean` without you declaring either.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/kinesis'
import { z } from 'zod'

const ReadingSchema = z.object({
  deviceId: z.string(),
  celsius: z.coerce.number(),
  calibrated: z.coerce.boolean().default(false),
})

export const readingRoute = defineRoute({
  filters: { eventSourceArn: TELEMETRY_STREAM_ARN },
  dataSchema: ReadingSchema,
}).handle(async ({ data, partitionKey }) => {
  if (!data.calibrated) return
  logger.info(`Device ${data.deviceId} on ${partitionKey} reported ${data.celsius}C`)
})

kinesisRouter.route(readingRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`KinesisRequest`](#generic-parameters) and your own types.

```ts
// handlers/onReading.ts
import { logger } from '@lambda-event-router/base'
import type { KinesisRequest, KinesisResponse } from '@lambda-event-router/kinesis'
import { z } from 'zod'

export const ReadingSchema = z.object({ deviceId: z.string(), celsius: z.number() })
type Reading = z.infer<typeof ReadingSchema>

export async function onReading(request: KinesisRequest<Reading>): Promise<KinesisResponse> {
  logger.info(`Device ${request.data.deviceId} reported ${request.data.celsius}C`)
}
```

```ts
// kinesis.ts
import { createKinesisRouter } from '@lambda-event-router/kinesis'
import { onReading, ReadingSchema } from './handlers/onReading'

const kinesisRouter = createKinesisRouter()

kinesisRouter.route({
  filters: { eventSourceArn: TELEMETRY_STREAM_ARN },
  dataSchema: ReadingSchema,
  handler: onReading,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
Exporting the schema from the handler file and attaching it to the route in the router file keeps the
type and the validation from drifting apart. See [annotated
handlers](/docs/handlers#annotated-handlers) for the worked version.

## Schema validation

`dataSchema` is the only key that takes a schema, and it is optional.

```ts
const ReadingSchema = z.object({
  deviceId: z.string(),
  celsius: z.coerce.number(),
  recordedAt: z.coerce.date(),
})

kinesisRouter.route({
  filters: { eventSourceArn: TELEMETRY_STREAM_ARN },
  dataSchema: ReadingSchema,
  handler: onReading,
})
```

| Key | Validates |
| --- | --- |
| `dataSchema` | The decoded, parsed record data |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so a record failing its schema throws rather than falling through to the next route. See
[schema validation](/docs/routing#schema-validation) for what your handler receives after coercion.

**An object schema fails every record whose data is not JSON.** A producer writing CSV lines or plain
text gets them through as the decoded string, which a `z.object()` rejects. Validate those with
`z.string()` and parse in the handler, or leave the schema off.

## Failures and retries

With `batchItemFailures` off, which is the default, records run one at a time in the order they arrive
and the first throw fails the invocation. Lambda retries the whole batch, and by default keeps retrying
that shard until the records succeed or age out, so a record that always throws holds up everything
behind it. `MaximumRetryAttempts` and a failure destination on the event source mapping are how you
bound that.

Turn it on and the router reports the failure back to Lambda instead.

```ts
const kinesisRouter = createKinesisRouter({ batchItemFailures: true })
```

**Reporting one failure reports every record after it too.** A shard is ordered, so the router stops at
the first throw and returns that record's `sequenceNumber` along with the `sequenceNumber` of every
record left in the batch. Lambda redelivers from the failed record onwards.

You also need to set the `ReportBatchItemFailures` response type on the event source mapping. Without
it, AWS ignores what the router returns.

## Middleware

Router and route middleware are both typed `KinesisMiddleware`, and the chain runs once per record, so
a batch of ten records runs it ten times.

```ts
import { logger } from '@lambda-event-router/base'
import type { KinesisMiddleware } from '@lambda-event-router/kinesis'

export const logInvocation: KinesisMiddleware = async (request, next) => {
  logger.info(`Handling record ${request.record.eventID} on ${request.partitionKey}`)
  return next(request)
}

export const withDeviceContext: KinesisMiddleware<Reading> = async (request, next) => {
  logger.info(`Handling device ${request.data.deviceId}`)
  return next(request)
}
```

```ts
const kinesisRouter = createKinesisRouter({ middleware: [logInvocation] })

kinesisRouter.route({
  filters: { eventSourceArn: TELEMETRY_STREAM_ARN },
  dataSchema: ReadingSchema,
  middleware: [withDeviceContext],
  handler: onReading,
})
```

**Route middleware carries the route's data type.** A `dataSchema` or an annotated handler narrows the
route to `KinesisMiddleware<Reading>`, and a plain `KinesisMiddleware` will not assign next to it. The
bare alias is right everywhere else, on the router and on a `defineRoute` route, since the schema there
does not narrow it.

Records are handled one at a time, so `appendKeys` on the shared logger cannot interleave the way it
does on SQS. Keys are cleared per invocation rather than per record, so one you set for a record stays
on every record after it in the same batch. See [middleware](/docs/middleware) for the execution order
and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/kinesis`.

| Type | Description |
| --- | --- |
| `KinesisRequest<TData>` | The handler argument |
| `KinesisResponse` | Handler return type, `undefined` |
| `KinesisFilters` | The `filters` object |
| `KinesisFilterInput` | What `custom` receives |
| `KinesisRouteDefinition<TData>` | A full route passed to `route()` |
| `KinesisRouterOptions` | Options for `createKinesisRouter` |
| `KinesisMiddleware<TData>` | Router and route middleware |

The `KinesisRouter` class and the `createKinesisRouter` and `defineRoute` functions come from the same
place.

### Generic parameters

The three types above that take a parameter take the same one.

| Parameter | Types | Default |
| --- | --- | --- |
| `TData` | `request.data` | `unknown` |

Leave it off and `data` is `unknown`, so `KinesisRequest` on its own is the right annotation for
middleware that only reads the partition key or the raw record.

You only need this for [annotated handlers](#annotated-handlers). Inference covers it.

## Code example

A telemetry stream and a device status stream feeding one Lambda, with a handler for each.

Open a file: [index.ts](#kinesis-example:index.ts) | [Kinesis router](#kinesis-example:kinesis.ts) | [handlers](#kinesis-example:handlers/devices.ts) | [schemas](#kinesis-example:schemas/device.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { kinesisRouter } from './kinesis.js'

const lambdaRouter = new LambdaRouter({
  routers: [kinesisRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'kinesis.ts',
    code: `import { createKinesisRouter } from '@lambda-event-router/kinesis'

import { onReading, onStatusChange } from './handlers/devices.js'
import { ReadingSchema, StatusSchema } from './schemas/device.js'

const TELEMETRY_STREAM_ARN = 'arn:aws:kinesis:eu-west-2:123456789012:stream/device-telemetry'
const STATUS_STREAM_ARN = 'arn:aws:kinesis:eu-west-2:123456789012:stream/device-status'

export const kinesisRouter = createKinesisRouter({ batchItemFailures: true })

kinesisRouter
  .route({
    filters: { eventSourceArn: TELEMETRY_STREAM_ARN },
    dataSchema: ReadingSchema,
    handler: onReading,
  })
  .route({
    filters: { eventSourceArn: STATUS_STREAM_ARN },
    dataSchema: StatusSchema,
    handler: onStatusChange,
  })`,
  },
  {
    path: 'handlers/devices.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { KinesisRequest, KinesisResponse } from '@lambda-event-router/kinesis'

import type { Reading, Status } from '../schemas/device.js'

const ALERT_THRESHOLD_C = 80

export async function onReading(request: KinesisRequest<Reading>): Promise<KinesisResponse> {
  const { deviceId, celsius } = request.data
  if (celsius < ALERT_THRESHOLD_C) return

  logger.info(\`Device \${deviceId} is running hot at \${celsius}C\`)
}

export async function onStatusChange(request: KinesisRequest<Status>): Promise<KinesisResponse> {
  const { deviceId, status } = request.data
  logger.info(\`Device \${deviceId} went \${status} at sequence \${request.sequenceNumber}\`)
}`,
  },
  {
    path: 'schemas/device.ts',
    code: `import { z } from 'zod'

export const ReadingSchema = z.object({
  deviceId: z.string(),
  celsius: z.coerce.number(),
  recordedAt: z.coerce.date(),
})

export const StatusSchema = z.object({
  deviceId: z.string(),
  status: z.enum(['online', 'offline', 'degraded']),
})

export type Reading = z.infer<typeof ReadingSchema>
export type Status = z.infer<typeof StatusSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="kinesis-example" default-file="kinesis.ts" line-numbers collapse-toggle fixed-height />

A record comes from one stream, so the two `eventSourceArn` filters cannot both match and the order you
register them in makes no difference. Put both record shapes on a single stream and it is
`partitionKey` doing that job instead, which needs a prefix per shape.

`onReading` returns early on a normal reading. A `custom` comparing `celsius` does the same job
in the router, which is worth it when a route is expensive to enter.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

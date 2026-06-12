# FirehoseRouter

`FirehoseRouter` transforms Amazon Data Firehose records on their way to a destination, one record at a
time.

Firehose hands your Lambda a batch of records and wants a result for every one of them: keep it, drop
it or mark it failed. The router base64 decodes each record's data, parses it as JSON, works out which
of your routes should handle it, then turns what your handler returns into that result.

Nothing here fails the invocation. A record that throws comes back as `ProcessingFailed` and the rest
of the batch carries on, so the router always returns one result per record it was given.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/firehose
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createFirehoseRouter } from '@lambda-event-router/firehose'
import { logInvocation } from './middleware/logInvocation'

const firehoseRouter = createFirehoseRouter({
  middleware: [logInvocation],  // Optional
})
```

The one option can be left out, so `createFirehoseRouter()` is what you want most of the time.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `FirehoseMiddleware[]` | No | `[]` | Runs for every record this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
firehoseRouter.route({
  filters: {
    deliveryStreamArn: WEB_LOG_STREAM_ARN,
  },
  dataSchema: LogLineSchema,  // Optional
  middleware: [withRecordTiming],  // Optional
  handler: normaliseLogLine,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
firehoseRouter.route(logLineRoute).route(appEventRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A record that matches no route comes back as `ProcessingFailed`.** Firehose sends those to the error
output prefix on your delivery stream rather than to the destination, and every other record in the
batch is unaffected. Register a catch-all route filtering only on `deliveryStreamArn` if you would
rather pass unknown records straight through with `Ok()`, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the records you want and leave the rest off.

```ts
firehoseRouter.route({
  filters: {
    deliveryStreamArn: [WEB_LOG_STREAM_ARN, APP_EVENT_STREAM_ARN],
    sourceKinesisStreamArn: CLICKSTREAM_ARN, // Or a pattern: /clickstream$/
    custom: ({ data }) => {
      // Only a custom reaches the decoded data
      if (!isObject(data) || typeof data.path !== 'string') return false

      return !data.path.startsWith('/health')
    },
  },
  handler: normaliseLogLine,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `deliveryStreamArn` | `FilterStringMatcher` | Matches the ARN of the delivery stream being transformed |
| `sourceKinesisStreamArn` | `FilterStringMatcher` | Matches the ARN of the Kinesis stream feeding that delivery stream |
| `custom` | `(input: FirehoseFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

Both ARN filters read the event rather than the record, so every record in a batch gets the same answer
from them. They pick out which delivery stream you are transforming, and telling records apart within
one stream is what `custom` is for.

**A `sourceKinesisStreamArn` filter never matches a delivery stream fed by direct PUT.** Only a
Kinesis-sourced stream carries that field, and the router skips the route when it is absent rather than
treating it as a wildcard.

**`custom` sees the data before any schema has run**, so narrow it with `isObject` from
`@lambda-event-router/base` rather than reading straight into it. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return a result for the record.

```ts
import type { FirehoseRequest, FirehoseResponse } from '@lambda-event-router/firehose'
import { Dropped, Ok } from '@lambda-event-router/firehose'

export async function normaliseLogLine(request: FirehoseRequest<LogLine>): Promise<FirehoseResponse> {
  const { path, status } = request.data
  if (path.startsWith('/health')) return Dropped()

  return Ok({ path, status })
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `data` | `TData` | The record's data, base64 decoded and JSON parsed. If it is not valid JSON you get the decoded string |
| `recordId` | `string` | Firehose's id for the record. The router puts it back on the result for you |
| `approximateArrivalTimestamp` | `number` | When Firehose accepted the record, as a Unix timestamp in milliseconds |
| `record` | `FirehoseTransformationEventRecord` | The untouched record from AWS, including the still encoded `data` |
| `context` | `Context` | The Lambda context |
| `metadata` | `FirehoseRecordMetadata` | The source record's `shardId`, `partitionKey` and `sequenceNumber`. Only set when a Kinesis stream feeds the delivery stream |

`FirehoseTransformationEventRecord`, `FirehoseRecordMetadata` and `Context` come from `aws-lambda`, not
from this package.

### Response type

`FirehoseResponse` is the result for one record, and you build it with `Ok`, `Dropped` or `Failed`
rather than writing the object yourself. Every handler has to return one.

```ts
return Ok({ path, status })
```

See [Responses](#responses) for what each helper does to the record.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineRoute` reads the schema and hands your handler a
fully typed `data`, defaults and coercion included, so `status` below is a `number` and `receivedAt` a
`Date` without you declaring either.

```ts
import { defineRoute, Dropped, Ok } from '@lambda-event-router/firehose'
import { z } from 'zod'

const LogLineSchema = z.object({
  path: z.string(),
  status: z.coerce.number(),
  receivedAt: z.coerce.date(),
})

export const logLineRoute = defineRoute({
  filters: { deliveryStreamArn: WEB_LOG_STREAM_ARN },
  dataSchema: LogLineSchema,
}).handle(async ({ data }) => {
  if (data.status < 400) return Dropped()

  return Ok({ path: data.path, status: data.status, day: data.receivedAt.toISOString().slice(0, 10) })
})

firehoseRouter.route(logLineRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`FirehoseRequest`](#generic-parameters) and your own types.

```ts
// handlers/normaliseLogLine.ts
import type { FirehoseRequest, FirehoseResponse } from '@lambda-event-router/firehose'
import { Ok } from '@lambda-event-router/firehose'
import { z } from 'zod'

export const LogLineSchema = z.object({ path: z.string(), status: z.coerce.number() })
type LogLine = z.infer<typeof LogLineSchema>

export async function normaliseLogLine(request: FirehoseRequest<LogLine>): Promise<FirehoseResponse> {
  return Ok({ path: request.data.path, status: request.data.status })
}
```

```ts
// firehose.ts
import { createFirehoseRouter } from '@lambda-event-router/firehose'
import { LogLineSchema, normaliseLogLine } from './handlers/normaliseLogLine'

const firehoseRouter = createFirehoseRouter()

firehoseRouter.route({
  filters: { deliveryStreamArn: WEB_LOG_STREAM_ARN },
  dataSchema: LogLineSchema,
  handler: normaliseLogLine,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
Exporting the schema from the handler file and attaching it to the route in the router file keeps the
type and the validation from drifting apart. See [annotated
handlers](/docs/handlers#annotated-handlers) for the worked version.

## Schema validation

`dataSchema` is the only key that takes a schema, and it is optional.

```ts
const LogLineSchema = z.object({
  path: z.string(),
  status: z.coerce.number(),
  durationMs: z.coerce.number(),
  receivedAt: z.coerce.date(),
})

firehoseRouter.route({
  filters: { deliveryStreamArn: WEB_LOG_STREAM_ARN },
  dataSchema: LogLineSchema,
  handler: normaliseLogLine,
})
```

| Key | Validates |
| --- | --- |
| `dataSchema` | The decoded, parsed record data |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so a record failing its schema is `ProcessingFailed` rather than something that falls through
to the next route. See [schema validation](/docs/routing#schema-validation) for what your handler
receives after coercion.

**An object schema fails every record whose data is not JSON.** A delivery stream carrying CSV lines or
raw log text gets them through as the decoded string, which a `z.object()` rejects. Validate those with
`z.string()` and parse in the handler, or leave the schema off.

## Responses

Firehose expects a verdict on every record, and the three helpers are how you give it. All of them come
from `@lambda-event-router/firehose`.

```ts
import { Dropped, Failed, Ok } from '@lambda-event-router/firehose'
```

| Return | Result | What reaches the destination |
| --- | --- | --- |
| `Ok()` | `Ok` | The record's original data, unchanged and not re-encoded |
| `Ok(data)` | `Ok` | Your `data`, JSON stringified unless it is already a string, then base64 encoded |
| `Ok(data, metadata)` | `Ok` | The same, plus `partitionKeys` for dynamic partitioning |
| `Dropped()` | `Dropped` | Nothing. Firehose discards the record |
| `Failed()` | `ProcessingFailed` | The original data, which Firehose sends to the error output prefix |

`Ok` handles the encoding, so pass it a plain object and leave `Buffer` and `JSON.stringify` out of
your handler.

**Throwing any of them works as well as returning them.** The router recognises a thrown result and
maps it the same way, which saves threading a return value back up from something the handler called.

```ts
if (!isRecognised(data.path)) throw Dropped()
```

Firehose gives you no channel for a failure reason, so if you need to know why a record failed, log it
in your handler before you return `Failed()`.

Anything else thrown is logged and becomes `ProcessingFailed` for that record. A record matching no
route or failing its schema lands there too, and in every case the other records in the batch still get
their own result.

### Dynamic partitioning

The second argument to `Ok` sets the partition keys Firehose substitutes into the destination prefix,
which is how you land records in a path built from their own contents.

```ts
const day = data.receivedAt.toISOString().slice(0, 10)

return Ok({ path: data.path, status: data.status }, { partitionKeys: { day } })
```

Turn dynamic partitioning on for the delivery stream and reference the same key names in its S3 prefix,
otherwise Firehose ignores what you return here.

## Middleware

Router and route middleware are both typed `FirehoseMiddleware`, and the chain runs once per record, so
a batch of ten records runs it ten times.

```ts
import { logger } from '@lambda-event-router/base'
import type { FirehoseMiddleware } from '@lambda-event-router/firehose'

export const logInvocation: FirehoseMiddleware = async (request, next) => {
  logger.info(`Transforming record ${request.recordId}`)
  return next(request)
}
```

```ts
const firehoseRouter = createFirehoseRouter({ middleware: [logInvocation] })

firehoseRouter.route({
  filters: { deliveryStreamArn: WEB_LOG_STREAM_ARN },
  middleware: [withRecordTiming],
  handler: normaliseLogLine,
})
```

**`FirehoseMiddleware` takes no type parameter**, so `request.data` is `unknown` inside middleware
whatever schema the route sets. Narrow it with `isObject` from `@lambda-event-router/base` if you need
to read it.

Middleware returns a `FirehoseResponse`, so returning `Dropped()` without calling `next` drops the
record and the handler never runs.

Records are handled one at a time, so `appendKeys` on the shared logger cannot interleave. Keys are
cleared per invocation rather than per record, so one you set for a record stays on every record after
it in the same batch. See [middleware](/docs/middleware) for the execution order and the three levels
it attaches at.

## Types

All exported from `@lambda-event-router/firehose`.

| Type | Description |
| --- | --- |
| `FirehoseRequest<TData>` | The handler argument |
| `FirehoseResponse` | Handler return type, the result for one record |
| `FirehoseResponseResult` | The interface `FirehoseResponse` aliases, what `Ok`, `Dropped` and `Failed` return |
| `FirehoseFilters` | The `filters` object |
| `FirehoseFilterInput` | What `custom` receives |
| `FirehoseRouteDefinition<TData>` | A full route passed to `route()` |
| `FirehoseRouterOptions` | Options for `createFirehoseRouter` |
| `FirehoseMiddleware` | Router and route middleware |

The `FirehoseRouter` class, the `createFirehoseRouter` and `defineRoute` functions and the `Ok`,
`Dropped` and `Failed` helpers come from the same place.

### Generic parameters

`FirehoseRequest` and `FirehoseRouteDefinition` take one parameter between them. `FirehoseMiddleware`
takes none.

| Parameter | Types | Default |
| --- | --- | --- |
| `TData` | `request.data` | `unknown` |

Leave it off and `data` is `unknown`, so `FirehoseRequest` on its own is the right annotation for a
handler that passes the record through without reading it.

You only need this for [annotated handlers](#annotated-handlers). Inference covers it.

## Code example

Two delivery streams feeding one Lambda, with web logs partitioned by day and health checks dropped.

Open a file: [index.ts](#firehose-example:index.ts) | [Firehose router](#firehose-example:firehose.ts) | [handlers](#firehose-example:handlers/logs.ts) | [schemas](#firehose-example:schemas/log.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { firehoseRouter } from './firehose.js'

const lambdaRouter = new LambdaRouter({
  routers: [firehoseRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'firehose.ts',
    code: `import { createFirehoseRouter } from '@lambda-event-router/firehose'

import { enrichAppEvent, normaliseLogLine } from './handlers/logs.js'
import { AppEventSchema, LogLineSchema } from './schemas/log.js'

const WEB_LOG_STREAM_ARN = 'arn:aws:firehose:eu-west-2:123456789012:deliverystream/web-logs'
const APP_EVENT_STREAM_ARN = 'arn:aws:firehose:eu-west-2:123456789012:deliverystream/app-events'

export const firehoseRouter = createFirehoseRouter()

firehoseRouter
  .route({
    filters: { deliveryStreamArn: WEB_LOG_STREAM_ARN },
    dataSchema: LogLineSchema,
    handler: normaliseLogLine,
  })
  .route({
    filters: { deliveryStreamArn: APP_EVENT_STREAM_ARN },
    dataSchema: AppEventSchema,
    handler: enrichAppEvent,
  })`,
  },
  {
    path: 'handlers/logs.ts',
    code: `import type { FirehoseRequest, FirehoseResponse } from '@lambda-event-router/firehose'
import { Dropped, Ok } from '@lambda-event-router/firehose'

import type { AppEvent, LogLine } from '../schemas/log.js'

export async function normaliseLogLine(request: FirehoseRequest<LogLine>): Promise<FirehoseResponse> {
  const { path, status, durationMs, receivedAt } = request.data
  if (path.startsWith('/health')) return Dropped()

  const day = receivedAt.toISOString().slice(0, 10)

  return Ok({ path, status, durationMs, day }, { partitionKeys: { day } })
}

export async function enrichAppEvent(request: FirehoseRequest<AppEvent>): Promise<FirehoseResponse> {
  const { name, userId } = request.data

  return Ok({ name, userId, recordId: request.recordId })
}`,
  },
  {
    path: 'schemas/log.ts',
    code: `import { z } from 'zod'

export const LogLineSchema = z.object({
  path: z.string(),
  status: z.coerce.number(),
  durationMs: z.coerce.number(),
  receivedAt: z.coerce.date(),
})

export const AppEventSchema = z.object({
  name: z.string(),
  userId: z.string(),
})

export type LogLine = z.infer<typeof LogLineSchema>
export type AppEvent = z.infer<typeof AppEventSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="firehose-example" default-file="firehose.ts" line-numbers collapse-toggle fixed-height />

Each route filters on a different delivery stream, and a batch only ever carries one of them, so the
order you register them in makes no difference. Both streams are covered, which keeps any record from
falling through to `ProcessingFailed`.

`normaliseLogLine` drops health checks rather than failing them, since they are noise rather than a
problem. The `day` key goes back as a partition key as well as into the record, so the destination
prefix can use it.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

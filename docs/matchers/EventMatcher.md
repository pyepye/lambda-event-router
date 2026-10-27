# EventMatcher

`EventMatcher` routes events that have no envelope of their own: EventBridge Scheduler payloads, Step
Functions task input, IoT Core rule actions and whatever JSON you send to `Invoke` yourself.

Every other matcher recognises its event source from the shape AWS wraps it in. There is no shape here,
so you say what a route matches with a `custom` and give it an `eventSchema` to validate and type
the payload.

## Install

```bash
npm install @latcher/base
```

`EventMatcher` lives in `base` alongside `Latcher`, so there is no second package to add.

## Which events reach it

`EventMatcher` refuses anything it recognises as a known AWS source, so adding one cannot quietly take
events away from the rest of your Lambda. It also refuses anything that is not a JSON object, which
includes a bare string and a top level array.

| Recognised by | Sources it refuses |
| --- | --- |
| `Records[0].eventSource` or `Records[0].EventSource` | SQS, SNS, S3, DynamoDB Streams, Kinesis, CodeCommit, SES |
| A top level `eventSource` | DocumentDB, ActiveMQ, RabbitMQ, Kafka |
| The record shape | A Kafka batch Lambda re-delivers, which names no source |
| `source` with `detail-type` and `detail` | EventBridge buses, pipes and rules |
| The request shape | ALB, API Gateway REST, HTTP and WebSocket, Lambda authorizers, VPC Lattice, AppSync Authorizer |
| Fields only that service sends | Cognito, Firehose, S3 Batch Operations, AppSync, AppSync Events, CloudWatch Logs, CodePipeline, Config, Connect, Lex, Secrets Manager |

**An EventBridge rule event is refused**, because a rule delivers the same envelope a bus does. Reach
for [EventBridgeMatcher](/matchers/EventBridgeMatcher) for those. EventBridge Scheduler is the one
EventBridge feature that lands here, since it sends the payload you configured rather than an envelope.

Everything else reaches it, so a Step Functions task input, a CloudFormation custom resource request
and your own `{ "action": "reindex" }` all get through.

## Create the matcher

```ts
import { createEventMatcher } from '@latcher/base'

import { withJobContext } from './middleware/withJobContext.js'

const eventMatcher = createEventMatcher({
  middleware: [withJobContext],  // Optional
})
```

`middleware` is the only option and it can be left out, so `createEventMatcher()` on its own is a
working matcher.

`createEventMatcher` takes one type parameter, the response every route on the matcher returns. Set it to
`void` where nothing is listening for a result.

```ts
const eventMatcher = createEventMatcher<void>()

eventMatcher.route({ filters: {}, handler: generateReport })
```

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `EventMatcherMiddleware[]` | No | `[]` | Runs for every event this matcher handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
eventMatcher.route({
  filters: {
    custom: ({ event }) => isObject(event) && event.command === 'generate-report',
  },
  eventSchema: ReportSchema,  // Optional
  middleware: [withReportContext],  // Optional
  handler: generateReport,
})
```

`filters` and `handler` are the only required keys, and `filters` may be an empty object.

`withReportContext` is typed `EventMatcherMiddleware<Report>` above rather than with the bare alias,
which matters on any route carrying an `eventSchema`. See [Middleware](#middleware) for why.

`route()` returns the matcher, so you can chain registrations.

```ts
eventMatcher.route(generateReportRoute).route(reindexRoute)
```

Routes are ranked by how specific they are. Where two overlap, the one matching only a subset of the
other is tried first, whatever order you registered them in. Registration order decides the rest, so give
each route filters no other route can match. See [match order](/docs/routing#match-order) for how ranking
works and what it cannot settle.

**A route with no `custom` matches every event this matcher will take.** It ranks last whatever order you
register it in, so the routes that do carry a `custom` still get their events. Two routes with different
`custom` functions cannot be ranked against each other, so those keep registration order. See
[Failures](#failures) for what leaving a catch-all off costs.

## Filters

`custom` is the only filter key, because there is no envelope to pick fields out of. It is also
optional, so an empty `filters` object is a deliberate catch-all.

`event` is `unknown`, so narrow it with `isObject` from `@latcher/base` before reading
anything. An `eventSchema` makes no difference here. Filters pick the route, and the schema runs
only once one has matched.

```ts
import { isObject } from '@latcher/base'

eventMatcher.route({
  filters: {
    custom: ({ event }) =>
      isObject(event) && event.command === 'generate-report' && event.tenantId === ACME_TENANT_ID,
  },
  eventSchema: ReportSchema,
  handler: generateReport,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `custom` | `(input: EventFilterInput) => boolean \| Promise<boolean>` | Given the raw event as `unknown`. Return `true` to take it. Can be async, and is awaited |

**`custom` sees every field as the caller sent it.** A field your schema coerces or defaults arrives
in its original form. Test it against what arrives, not against what the schema promises.

See [`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return whatever you typed the matcher's response as.

```ts
import { logger } from '@latcher/base'
import type { EventRequest } from '@latcher/base'

export async function generateReport(request: EventRequest<Report>): Promise<ReportResult> {
  const { reportId, day } = request.event
  logger.info(`Building report ${reportId} for ${day}`)

  return { reportId, status: 'built' }
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `event` | `TPayload` | The event, validated by `eventSchema` where you set one and untouched where you did not |
| `context` | `Context` | The Lambda context |

`Context` comes from `aws-lambda`, not from this package. There is no `record` field, because a custom
payload is the whole event rather than one entry in a batch.

### Response type

There is no `EventResponse` type. What a handler returns is the type parameter you gave
`createEventMatcher`, and it defaults to `unknown`.

`handleEvent` hands your return value back untouched, so `Latcher` returns it to whoever invoked
the Lambda. A synchronous `Invoke` gets it as the response payload and a Step Functions task gets it as
the task output. Use `createEventMatcher<void>()` where nobody reads it.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineEventRoute` reads `eventSchema` and hands your
handler a fully typed `event`, defaults and coercion included, so `pages` below is a `number` without
you declaring that anywhere.

```ts
import { defineEventRoute, isObject, logger } from '@latcher/base'
import { z } from 'zod'

const ReportSchema = z.object({
  command: z.literal('generate-report'),
  reportId: z.string(),
  pages: z.coerce.number().default(10),
})

export const generateReportRoute = defineEventRoute({
  filters: {
    custom: ({ event }) => isObject(event) && event.command === 'generate-report',
  },
  eventSchema: ReportSchema,
}).handle(async ({ event }) => {
  logger.info(`Building report ${event.reportId} over ${event.pages} pages`)

  return { reportId: event.reportId, status: 'built' }
})

eventMatcher.route(generateReportRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`EventRequest`](#generic-parameters) and your own types.

```ts
// handlers/generateReport.ts
import { logger } from '@latcher/base'
import type { EventRequest } from '@latcher/base'
import { z } from 'zod'

export const ReportSchema = z.object({
  command: z.literal('generate-report'),
  reportId: z.string(),
})
type Report = z.infer<typeof ReportSchema>

export async function generateReport(request: EventRequest<Report>): Promise<unknown> {
  logger.info(`Building report ${request.event.reportId}`)

  return { reportId: request.event.reportId, status: 'built' }
}
```

```ts
// events.ts
import { createEventMatcher, isObject } from '@latcher/base'

import { generateReport, ReportSchema } from './handlers/generateReport.js'

const eventMatcher = createEventMatcher()

eventMatcher.route({
  filters: {
    custom: ({ event }) => isObject(event) && event.command === 'generate-report',
  },
  eventSchema: ReportSchema,
  handler: generateReport,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
See [annotated handlers](/docs/handlers#annotated-handlers) for the worked version.

## Schema validation

`eventSchema` is the only schema key, and it validates the whole event.

```ts
const ReportSchema = z.object({
  command: z.literal('generate-report'),
  reportId: z.string(),
  pages: z.coerce.number().default(10),
})

eventMatcher.route({
  filters: {
    custom: ({ event }) => isObject(event) && event.command === 'generate-report',
  },
  eventSchema: ReportSchema,
  handler: generateReport,
})
```

| Key | Validates |
| --- | --- |
| `eventSchema` | The whole event |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so an event failing its schema throws `Schema validation failed for event` rather than falling
through to the next route. See [schema validation](/docs/routing#schema-validation) for what your
handler receives after coercion.

A `z.literal()` on the field your `custom` tested is worth keeping even though it looks
redundant, since the filter reads the raw event and the schema is what narrows the type your handler
sees.

## Failures

An event that matches no route throws `No route matched for event`, and a failing `eventSchema` throws
`Schema validation failed for event`. Both fail the invocation, since there is no batch to report
against and no response shape to answer with.

**An event nothing matches usually fails one level up instead.** `canHandleEvent` runs the same route
matching, so `EventMatcher` declines an event none of its routes match and `Latcher` throws
`No matcher found for event`. You only see `No route matched for event` when you call `handleEvent`
yourself.

What retries depends on who invoked the Lambda rather than on this matcher. A synchronous `Invoke` gets
the error back, and an asynchronous one retries before the event goes to your dead letter queue.

Your `custom` runs once per event. `canHandleEvent` matches the event to decide whether this matcher
claims it, then `handleEvent` reuses that match rather than running your filters a second time.

## Middleware

Matcher and route middleware are both typed `EventMatcherMiddleware`, and the chain runs once per event.

```ts
import { logger } from '@latcher/base'
import type { EventMatcherMiddleware } from '@latcher/base'

export const withJobContext: EventMatcherMiddleware = async (request, next) => {
  logger.appendKeys({ requestId: request.context.awsRequestId })

  return next(request)
}
```

```ts
const eventMatcher = createEventMatcher({ middleware: [withJobContext] })

eventMatcher.route({
  filters: { custom: ({ event }) => isObject(event) && event.command === 'generate-report' },
  eventSchema: ReportSchema,
  middleware: [withReportContext],
  handler: generateReport,
})
```

**On a route with an `eventSchema`, type route middleware with the payload.** The bare
`EventMatcherMiddleware` alias defaults its payload to `unknown`. Inside the middleware
`request.event` is then `unknown`, so you cannot read the fields the schema guarantees. The route
around it keeps its own types either way.

```ts
import type { EventMatcherMiddleware } from '@latcher/base'

import type { Report } from './schemas/report.js'

export const withReportContext: EventMatcherMiddleware<Report> = async (request, next) => {
  logger.appendKeys({ reportId: request.event.reportId })

  return next(request)
}
```

One event per invocation means `appendKeys` is safe here, unlike on the record based matchers where a
batch runs in parallel. See [middleware](/docs/middleware) for the execution order and the three levels
it attaches at.

## Types

All exported from `@latcher/base`.

| Type | Description |
| --- | --- |
| `EventRequest<TPayload>` | The handler argument |
| `EventFilters` | The `filters` object |
| `EventFilterInput` | What `custom` receives, `{ event: unknown }` |
| `EventRouteDefinition<TPayload, TResponse>` | A full route passed to `route()` |
| `EventHandler<TPayload, TResponse>` | The `handler` function |
| `EventMatcherMiddleware<TPayload, TResponse>` | Matcher and route middleware |
| `EventMatcherOptions<TResponse>` | Options for `createEventMatcher` |

The `EventMatcher` class and the `createEventMatcher` and `defineEventRoute` functions come from the same
place.

### Generic parameters

`TPayload` and `TResponse` are the two parameters, in that order, and both default to `unknown`.

| Parameter | Types | Default |
| --- | --- | --- |
| `TPayload` | `request.event` | `unknown` |
| `TResponse` | What the handler returns | `unknown` |

`EventMatcher` and `createEventMatcher` take `TResponse` on its own, so `createEventMatcher<void>()` types
every handler on the matcher as returning nothing.

`defineEventRoute` takes them in the order `TPayload`, `TResponse`. `TPayload` types the handler.
Filters take neither parameter, since `custom` is always handed an `unknown` event.

You only need these for [annotated handlers](#annotated-handlers). Inference covers both.

## Code example

An operations Lambda taking three payloads it invents the shape of: a nightly report from EventBridge
Scheduler, a reindex task from Step Functions and a manual cache purge over `Invoke`.

Open a file: [index.ts](#event-example:index.ts) | [event matcher](#event-example:events.ts) | [handlers](#event-example:handlers/operations.ts) | [schemas](#event-example:schemas/operations.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { eventMatcher } from './events.js'

const latcher = new Latcher({
  matchers: [eventMatcher],
})

export const handler: Handler = latcher.handler()`,
  },
  {
    path: 'events.ts',
    code: `import { createEventMatcher, isObject } from '@latcher/base'

import { generateReport, purgeCache, reindex } from './handlers/operations.js'
import { PurgeSchema, ReindexSchema, ReportSchema } from './schemas/operations.js'

export const eventMatcher = createEventMatcher()

// Each route tests a different command, so no event matches two and the order does not matter
eventMatcher
  .route({
    filters: { custom: ({ event }) => isObject(event) && event.command === 'generate-report' },
    eventSchema: ReportSchema,
    handler: generateReport,
  })
  .route({
    filters: { custom: ({ event }) => isObject(event) && event.command === 'reindex' },
    eventSchema: ReindexSchema,
    handler: reindex,
  })
  .route({
    filters: { custom: ({ event }) => isObject(event) && event.command === 'purge-cache' },
    eventSchema: PurgeSchema,
    handler: purgeCache,
  })`,
  },
  {
    path: 'handlers/operations.ts',
    code: `import { logger } from '@latcher/base'
import type { EventRequest } from '@latcher/base'

import type { Purge, Reindex, Report } from '../schemas/operations.js'

export async function generateReport(request: EventRequest<Report>): Promise<unknown> {
  const { reportId, day } = request.event
  logger.info(\`Building report \${reportId} for \${day}\`)

  return { reportId, status: 'built' }
}

export async function reindex(request: EventRequest<Reindex>): Promise<unknown> {
  const { collection, batchSize } = request.event
  logger.info(\`Reindexing \${collection} in batches of \${batchSize}\`)

  return { collection, status: 'reindexed' }
}

export async function purgeCache(request: EventRequest<Purge>): Promise<unknown> {
  logger.info(\`Purging the cache for \${request.event.tenantId}\`)

  return { tenantId: request.event.tenantId, status: 'purged' }
}`,
  },
  {
    path: 'schemas/operations.ts',
    code: `import { z } from 'zod'

// The literal narrows the type the handler sees. The custom reads the raw event instead
export const ReportSchema = z.object({
  command: z.literal('generate-report'),
  reportId: z.string(),
  day: z.iso.date(),
})

export const ReindexSchema = z.object({
  command: z.literal('reindex'),
  collection: z.string(),
  batchSize: z.coerce.number().default(500),
})

export const PurgeSchema = z.object({
  command: z.literal('purge-cache'),
  tenantId: z.string(),
})

export type Report = z.infer<typeof ReportSchema>
export type Reindex = z.infer<typeof ReindexSchema>
export type Purge = z.infer<typeof PurgeSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="event-example" default-file="events.ts" line-numbers collapse-toggle fixed-height />

There is no catch-all route, so a payload carrying an unknown `command` is declined by this matcher and
fails at `Latcher` with `No matcher found for event`. Adding one would make this matcher claim every
event no dedicated matcher recognised, which is the cost worth weighing rather than a default.

`batchSize` is `500` in the handler when the payload leaves it out, because the handler is given the
schema output. The `custom` above it reads the raw event and only tests `command`.

`index.ts` hands the matcher to `Latcher`, which is what AWS invokes and what every matcher in the
Lambda gets registered on. See [matchers](/docs/matchers) for how the two levels of matching fit
together.

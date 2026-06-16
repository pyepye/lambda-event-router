# @lambda-event-router/kinesis

Kinesis Data Streams routing with schema validation, partition key filtering, and batch failure support.

**Supported AWS Services:** `Amazon Kinesis Data Streams`

**Available Routers:** `KinesisRouter`

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/kinesis
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { kinesisRouter } from './kinesis'

const lambdaRouter = new LambdaRouter({
  routers: [kinesisRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// kinesis.ts
import { createKinesisRouter, defineRoute } from '@lambda-event-router/kinesis'
import { z } from 'zod'

const kinesisRouter = createKinesisRouter()

// Inline functions allows Typescript to automatic infer types
const processRecord = defineRoute({
  filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789:stream/my-stream' },
  dataSchema: z.object({ orderId: z.string(), total: z.number() }),
}).handle(async ({ data, partitionKey, sequenceNumber }) => {
  console.log(`Order ${data.orderId}: $${data.total} (partition: ${partitionKey})`)
})
kinesisRouter.route(processRecord)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// kinesis.ts
import { createKinesisRouter } from '@lambda-event-router/kinesis'

const kinesisRouter = createKinesisRouter()

// Separate handler to define routes and handlers in different places
kinesisRouter.route({
  filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789:stream/my-stream' },
  dataSchema: DataSchema,
  handler: processRecord,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processRecord({ data, partitionKey, sequenceNumber }) {
  console.log(`Order ${data.orderId}: $${data.total} (partition: ${partitionKey})`)
}
```


## Usage

#### Inline handlers

```ts
import { createKinesisRouter, defineRoute } from '@lambda-event-router/kinesis'

const kinesisRouter = createKinesisRouter()

const processRecord = defineRoute({
  filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789:stream/my-stream' },
  dataSchema: DataSchema,
}).handle(async ({ data, partitionKey, sequenceNumber }) => {
  console.log(`Order ${data.orderId}: $${data.total} (partition: ${partitionKey})`)
})

kinesisRouter.route(processRecord)
```

#### Separate handlers

```ts
import { createKinesisRouter } from '@lambda-event-router/kinesis'

const kinesisRouter = createKinesisRouter()

kinesisRouter.route({
  filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789:stream/my-stream' },
  dataSchema: DataSchema,
  handler: processRecord,
})

async function processRecord({ data, partitionKey, sequenceNumber }) {
  console.log(`Order ${data.orderId}: $${data.total} (partition: ${partitionKey})`)
}
```

#### Filters

```ts
defineRoute({
  filters: {
    eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789:stream/my-stream',
    partitionKey: ['orders', 'inventory'],
    custom: ({ data }) => data.priority === 'HIGH',
  },
})
```

#### Middleware

Register middleware on the router to cover every route, or on a single route. Type route middleware to
the route's schema, so `KinesisMiddleware<Reading>` rather than `KinesisMiddleware`.

```ts
import type { KinesisMiddleware } from '@lambda-event-router/kinesis'

const withDeviceContext: KinesisMiddleware<Reading> = async (request, next) => {
  console.log(`Device ${request.data.deviceId}`)
  return next(request)
}
```

#### Batch failure reporting

```ts
const kinesisRouter = createKinesisRouter({ batchItemFailures: true })
```

When enabled, failed records are reported back to Kinesis as partial batch failures instead of failing the entire batch.

## Examples

See the [examples/kinesis](../../examples/kinesis) directory for complete working examples.

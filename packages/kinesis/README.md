# @lambda-event-router/kinesis

Routes each record in a Kinesis Data Streams batch to a handler by stream or partition key. The router decodes the data, unpacks aggregated records and runs them in order.

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

// An inferred handler takes its types from the route
const processRecord = defineRoute({
  filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789:stream/my-stream' },
  dataSchema: z.object({ orderId: z.string(), total: z.number() }),
}).handle(async ({ data, partitionKey, sequenceNumber }) => {
  console.log(`Order ${data.orderId}: $${data.total} (partition: ${partitionKey})`)
})
kinesisRouter.route(processRecord)
```

Or use an annotated handler, which names its types rather than inferring them:

```ts
// kinesis.ts
import { createKinesisRouter } from '@lambda-event-router/kinesis'
import type { KinesisRequest } from '@lambda-event-router/kinesis'
import { z } from 'zod'

const DataSchema = z.object({ orderId: z.string(), total: z.number() })
type Order = z.infer<typeof DataSchema>

const kinesisRouter = createKinesisRouter()

kinesisRouter.route({
  filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789:stream/my-stream' },
  dataSchema: DataSchema,
  handler: processRecord,
})

// An annotated handler names its own types
export async function processRecord({ data, partitionKey, sequenceNumber }: KinesisRequest<Order>) {
  console.log(`Order ${data.orderId}: $${data.total} (partition: ${partitionKey})`)
}
```


## Usage

#### Inferred handlers

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

#### Annotated handlers

```ts
import { createKinesisRouter } from '@lambda-event-router/kinesis'
import type { KinesisRequest } from '@lambda-event-router/kinesis'
import type { z } from 'zod'

type Order = z.infer<typeof DataSchema>

const kinesisRouter = createKinesisRouter()

kinesisRouter.route({
  filters: { eventSourceArn: 'arn:aws:kinesis:us-east-1:123456789:stream/my-stream' },
  dataSchema: DataSchema,
  handler: processRecord,
})

async function processRecord({ data, partitionKey, sequenceNumber }: KinesisRequest<Order>) {
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

#### Binary payloads

`data` is the record decoded as UTF-8 text and parsed as JSON. A payload that is not text, such as gzip
or protobuf, comes out mangled, so read `rawData` for the bytes instead.

```ts
defineRoute({
  filters: {},
}).handle(async ({ rawData }) => {
  const json = gunzipSync(rawData).toString('utf-8')
  console.log(JSON.parse(json))
})
```

#### Aggregated records

A record written with KPL aggregation holds many messages. The router unpacks it and routes each
message on its own, with its own `data`, `rawData` and `partitionKey`.

Messages from one aggregated record share a `sequenceNumber`, so use `sequenceNumber` and
`subSequenceNumber` together as the idempotency key. A throw on one message retries the whole
aggregated record.

#### Batch failure reporting

```ts
const kinesisRouter = createKinesisRouter({ batchItemFailures: true })
```

When enabled, failed records are reported back to Kinesis as partial batch failures instead of failing the entire batch.

## Examples

See the [service-examples/kinesis](../../service-examples/kinesis) directory for complete working examples.

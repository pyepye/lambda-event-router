# @lambda-event-router/kinesis

Routes each record in a Kinesis Data Streams batch to a handler by stream or partition key. The router decodes the data, unpacks aggregated records and runs them in order.

**Supported AWS Services:** `Amazon Kinesis Data Streams`

**Available Routers:** `KinesisRouter`

**Docs:** [KinesisRouter](https://pyepye.github.io/lambda-event-router/routers/KinesisRouter)

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
  routers: [kinesisRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// kinesis.ts
import { createKinesisRouter, defineRoute } from '@lambda-event-router/kinesis'
import { z } from 'zod'

export const kinesisRouter = createKinesisRouter()

const sensorReading = defineRoute({
  filters: {
    eventSourceArn: 'arn:aws:kinesis:eu-west-2:123456789012:stream/telemetry',
    partitionKey: /^sensor-/,
  },
  dataSchema: z.object({ deviceId: z.string(), celsius: z.number() }),
}).handle(async ({ data }) => {
  console.log(`Device ${data.deviceId} reported ${data.celsius}C`)
})

kinesisRouter.route(sensorReading)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/KinesisRouter#annotated-handlers).

## Documentation

- [KinesisRouter](https://pyepye.github.io/lambda-event-router/routers/KinesisRouter) covers every filter, schema validation, aggregated records, and failures and retries.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/kinesis](../../service-examples/kinesis) for a deployable app.

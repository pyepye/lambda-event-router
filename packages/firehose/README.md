# @lambda-event-router/firehose

Routes each record in a Firehose transformation batch to a handler. The router decodes the data and turns your return value into the keep, drop or fail result Firehose needs.

**Supported AWS Services:** `Amazon Data Firehose`

**Available Routers:** `FirehoseRouter`

**Docs:** [FirehoseRouter](https://pyepye.github.io/lambda-event-router/routers/FirehoseRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/firehose
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { firehoseRouter } from './firehose'

const lambdaRouter = new LambdaRouter({
  routers: [firehoseRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// firehose.ts
import { createFirehoseRouter, defineRoute, Ok } from '@lambda-event-router/firehose'
import { z } from 'zod'

export const firehoseRouter = createFirehoseRouter()

const logLine = defineRoute({
  filters: {
    deliveryStreamArn: 'arn:aws:firehose:eu-west-2:123456789012:deliverystream/web-logs',
    sourceKinesisStreamArn: 'arn:aws:kinesis:eu-west-2:123456789012:stream/web-logs',
  },
  dataSchema: z.object({ path: z.string(), status: z.number() }),
}).handle(async ({ data }) => {
  console.log(`${data.status} on ${data.path}`)
  return Ok({ path: data.path, status: data.status })
})

firehoseRouter.route(logLine)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/FirehoseRouter#annotated-handlers).

## Documentation

- [FirehoseRouter](https://pyepye.github.io/lambda-event-router/routers/FirehoseRouter) covers every filter, schema validation, responses and dynamic partitioning.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/firehose](../../service-examples/firehose) for a deployable app.

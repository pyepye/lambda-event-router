# @lambda-event-router/firehose

Routes each record in a Firehose transformation batch to a handler. The router decodes the data and turns your return value into the keep, drop or fail result Firehose needs.

**Supported AWS Services:** `Amazon Data Firehose`

**Available Routers:** `FirehoseRouter`

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
  routers: [firehoseRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// firehose.ts
import { createFirehoseRouter, defineRoute, Ok } from '@lambda-event-router/firehose'

const firehoseRouter = createFirehoseRouter()

// An inferred handler takes its types from the route
const processRecord = defineRoute({
  filters: { deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789:deliverystream/my-stream' },
}).handle(async ({ data }) => {
  return Ok(data)
})
firehoseRouter.route(processRecord)
```

Or use an annotated handler, which names its types rather than inferring them:

```ts
// firehose.ts
import { createFirehoseRouter, Ok } from '@lambda-event-router/firehose'
import type { FirehoseRequest } from '@lambda-event-router/firehose'

const firehoseRouter = createFirehoseRouter()

firehoseRouter.route({
  filters: { deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789:deliverystream/my-stream' },
  handler: processRecord,
})

// An annotated handler names its own types
export async function processRecord({ data }: FirehoseRequest) {
  return Ok(data)
}
```


## Usage

#### Inferred handlers

```ts
import { createFirehoseRouter, defineRoute, Ok } from '@lambda-event-router/firehose'

const firehoseRouter = createFirehoseRouter()

const processRecord = defineRoute({
  filters: { deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789:deliverystream/my-stream' },
}).handle(async ({ data }) => {
  return Ok(data)
})

firehoseRouter.route(processRecord)
```

#### Annotated handlers

```ts
import { createFirehoseRouter, Ok } from '@lambda-event-router/firehose'
import type { FirehoseRequest } from '@lambda-event-router/firehose'

const firehoseRouter = createFirehoseRouter()

firehoseRouter.route({
  filters: { deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789:deliverystream/my-stream' },
  handler: processRecord,
})

async function processRecord({ data }: FirehoseRequest) {
  return Ok(data)
}
```

#### Filters

```ts
defineRoute({
  filters: {
    deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789:deliverystream/my-stream',
    custom: ({ record }) => record.approximateArrivalTimestamp > someThreshold,
  },
})
```

#### Middleware

Register middleware on the router to cover every route, or on a single route. Type route middleware to
the route's schema, so `FirehoseMiddleware<LogLine>` rather than `FirehoseMiddleware`.

```ts
import type { FirehoseMiddleware } from '@lambda-event-router/firehose'

const withLogLineContext: FirehoseMiddleware<LogLine> = async (request, next) => {
  console.log(`Transforming ${request.data.path}`)
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
  return Ok(JSON.parse(json))
})
```

## Examples

See the [service-examples/firehose](../../service-examples/firehose) directory for complete working examples.

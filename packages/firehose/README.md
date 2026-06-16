# @lambda-event-router/firehose

Kinesis Data Firehose transformation routing. Routes records for processing and returns Ok, Failed, or Dropped results.

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
import { createFirehoseRouter, defineRoute } from '@lambda-event-router/firehose'

const firehoseRouter = createFirehoseRouter()

// Inline functions allows Typescript to automatic infer types
const processRecord = defineRoute({
  filters: { deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789:deliverystream/my-stream' },
}).handle(async ({ data }) => {
  // Transform and return the record
})
firehoseRouter.route(processRecord)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// firehose.ts
import { createFirehoseRouter } from '@lambda-event-router/firehose'

const firehoseRouter = createFirehoseRouter()

// Separate handler to define routes and handlers in different places
firehoseRouter.route({
  filters: { deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789:deliverystream/my-stream' },
  handler: processRecord,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processRecord({ data }) {
  // Transform and return the record
}
```


## Usage

#### Inline handlers

```ts
import { createFirehoseRouter, defineRoute } from '@lambda-event-router/firehose'

const firehoseRouter = createFirehoseRouter()

const processRecord = defineRoute({
  filters: { deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789:deliverystream/my-stream' },
}).handle(async ({ data }) => {
  // Transform and return the record
})

firehoseRouter.route(processRecord)
```

#### Separate handlers

```ts
import { createFirehoseRouter } from '@lambda-event-router/firehose'

const firehoseRouter = createFirehoseRouter()

firehoseRouter.route({
  filters: { deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789:deliverystream/my-stream' },
  handler: processRecord,
})

async function processRecord({ data }) {
  // Transform and return the record
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

## Examples

See the [examples/firehose](../../examples/firehose) directory for complete working examples.

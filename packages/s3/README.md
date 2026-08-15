# @lambda-event-router/s3

Routes S3 object notifications to handlers by bucket, key pattern and event name. A second router handles S3 Batch Operations tasks and builds the result the job expects.

**Supported AWS Services:** `Amazon S3`

**Available Routers:** `S3Router` | `S3BatchRouter`

**Docs:** [S3Router](https://pyepye.github.io/lambda-event-router/routers/S3Router) | [S3BatchRouter](https://pyepye.github.io/lambda-event-router/routers/S3BatchRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/s3
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { s3Router } from './s3'
import { s3BatchRouter } from './s3Batch'

const lambdaRouter = new LambdaRouter({
  routers: [s3Router, s3BatchRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// s3.ts
import { createS3Router, defineRoute } from '@lambda-event-router/s3'

export const s3Router = createS3Router()

const processUpload = defineRoute({
  filters: {
    eventName: 'ObjectCreated:Put',
    bucket: 'my-app-uploads',
    key: 'uploads/*.csv',
  },
}).handle(async ({ bucket, key, objectSize }) => {
  console.log(`Processing ${key} from ${bucket}, ${objectSize} bytes`)
})

s3Router.route(processUpload)
```

```ts
// s3Batch.ts
import { createS3BatchRouter, Succeeded } from '@lambda-event-router/s3'

export const s3BatchRouter = createS3BatchRouter()

s3BatchRouter.route({
  handler: async ({ bucket, key }) => {
    console.log(`Converting ${key} from ${bucket}`)
    return Succeeded(`Converted ${key}`)
  },
})
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/S3Router#annotated-handlers).

## Documentation

- [S3Router](https://pyepye.github.io/lambda-event-router/routers/S3Router) covers every filter, convenience methods,
  the S3 test event and failures and retries.
- [S3BatchRouter](https://pyepye.github.io/lambda-event-router/routers/S3BatchRouter) covers task results, schema versions
  and running one Lambda for both routers.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/s3](../../service-examples/s3) for a deployable app.

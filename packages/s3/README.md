# @lambda-event-router/s3

S3 notification routing by bucket, key pattern and event name, with convenience methods for the object, lifecycle, tagging and ACL events. A separate router for S3 Batch Operations.

**Supported AWS Services:** `Amazon S3`

**Available Routers:** `S3Router` | `S3BatchRouter`

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

const lambdaRouter = new LambdaRouter({
  routers: [s3Router]
})

export const handler = lambdaRouter.handler()
```

```ts
// s3.ts
import { createS3Router, defineRoute } from '@lambda-event-router/s3'

const s3Router = createS3Router()

// Inline functions allows Typescript to automatic infer types
const processUpload = defineRoute({
  filters: {
    eventName: 'ObjectCreated:*',
    bucket: 'my-uploads-bucket',
    key: ['uploads/*', '*.json'],
  },
}).handle(async ({ bucket, key, objectSize, eventName }) => {
  console.log(`${eventName}: ${key} in ${bucket} (${objectSize} bytes)`)
})
s3Router.route(processUpload)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// s3.ts
import { createS3Router, type S3ObjectCreatedRequest } from '@lambda-event-router/s3'

const s3Router = createS3Router()

// Separate handler to define routes and handlers in different places
s3Router.objectCreated({
  filters: {
    bucket: 'my-uploads-bucket',
    key: ['uploads/*', '*.json'],
  },
  handler: processUpload,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processUpload({ bucket, key, objectSize, eventName }: S3ObjectCreatedRequest) {
  console.log(`${eventName}: ${key} in ${bucket} (${objectSize} bytes)`)
}
```


## Usage

### S3Router

#### Inline handlers

```ts
import { createS3Router, defineRoute } from '@lambda-event-router/s3'

const s3Router = createS3Router()

const processUpload = defineRoute({
  filters: {
    eventName: 'ObjectCreated:*',
    bucket: 'my-uploads-bucket',
    key: ['uploads/*', '*.json'],
  },
}).handle(async ({ bucket, key, objectSize, eventName }) => {
  console.log(`${eventName}: ${key} in ${bucket} (${objectSize} bytes)`)
})

s3Router.route(processUpload)
```

#### Separate handlers

```ts
import { createS3Router, type S3ObjectCreatedRequest } from '@lambda-event-router/s3'

const s3Router = createS3Router()

s3Router.objectCreated({
  filters: {
    bucket: 'my-uploads-bucket',
    key: ['uploads/*', '*.json'],
  },
  handler: processUpload,
})

async function processUpload({ bucket, key, objectSize, eventName }: S3ObjectCreatedRequest) {
  console.log(`${eventName}: ${key} in ${bucket} (${objectSize} bytes)`)
}
```

#### Helper methods

```ts
// ObjectCreated
s3Router.objectCreated()
s3Router.objectCreatedPut()
s3Router.objectCreatedPost()
s3Router.objectCreatedCopy()
s3Router.objectCreatedCompleteMultipartUpload()

// ObjectRemoved
s3Router.objectRemoved()
s3Router.objectRemovedDelete()
s3Router.objectRemovedDeleteMarkerCreated()

// ObjectRestore
s3Router.objectRestore()
s3Router.objectRestorePost()
s3Router.objectRestoreCompleted()
s3Router.objectRestoreDelete()

// Lifecycle
s3Router.lifecycleExpiration()
s3Router.lifecycleExpirationDelete()
s3Router.lifecycleExpirationDeleteMarkerCreated()
s3Router.lifecycleTransition()

// ObjectTagging
s3Router.objectTagging()
s3Router.objectTaggingPut()
s3Router.objectTaggingDelete()

// Other
s3Router.objectAclPut()
s3Router.reducedRedundancyLostObject()
s3Router.intelligentTiering()
s3Router.testEvent()
```

#### Filters

`key` is a single matcher rather than separate prefix and suffix options, so use `*` to build both. It
is matched whole, so `uploads/` on its own matches nothing.

```ts
defineRoute({
  filters: {
    eventName: 'ObjectCreated:Put',
    bucket: 'my-images-bucket',
    key: ['images/*', 'photos/*', '*thumbnail*', '*.jpg', '*.png', '*.webp'],
    custom: ({ record }) => record.s3.object.size >= 100 * 1024 * 1024,
  },
})
```

#### S3 test event

S3 sends a one-off `s3:TestEvent` when you first configure a bucket notification. It has no `Records`,
so register a handler with `testEvent()` rather than a normal route.

```ts
s3Router.testEvent({
  handler: async ({ bucket, time }) => {
    console.log(`Notifications live on ${bucket} from ${time}`)
  },
})
```

Skip `testEvent()` and the router still claims the event and returns without doing anything, so the
invocation succeeds instead of failing with no matching route.

### S3BatchRouter

An S3 Batch Operations job is a different trigger to a notification, so it has its own router. The job
already chose the objects, so the route takes no filters and there is only ever one of it.

```ts
import { createS3BatchRouter, Succeeded } from '@lambda-event-router/s3'

export const s3BatchRouter = createS3BatchRouter().route({
  handler: async ({ bucket, key }) => {
    // Process the object
    return Succeeded()
  },
})
```

A handler returns `Succeeded`, `TemporaryFailure` or `PermanentFailure`, and the router assembles the
result envelope the job reads.

Set `treatMissingKeysAs` on the route to control how the job counts a task left out of the response. It
defaults to `PermanentFailure`.

The router takes both payload schemas. A job picks one with `InvocationSchemaVersion`, and 2.0 is
required for a directory bucket or for passing `UserArguments`. The handler gets the same `bucket`,
`key` and `versionId` either way, and `userArguments` on 2.0.

Register both routers when one Lambda does both jobs.

```ts
import { LambdaRouter } from '@lambda-event-router/base'

const lambdaRouter = new LambdaRouter({ routers: [s3Router, s3BatchRouter] })
```

## Examples

See the [service-examples/s3](../../service-examples/s3) directory for complete working examples.

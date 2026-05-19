# @lambda-event-router/s3

S3 event routing by bucket, key pattern and event name. Convenience methods for the object, lifecycle, tagging and ACL events, plus S3 Batch Operations.

**Supported AWS Services:** `Amazon S3`

**Available Routers:** `S3Router`

## Install

```bash
npm install @lambda-event-router/s3
```


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
s3Router.batchOperation()
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

#### S3 Batch Operations

A batch route is registered with `batchOperation()` and takes no filters, since a batch job invokes the
function directly rather than arriving as a notification.

```ts
import { createS3Router, Succeeded, TemporaryFailure, PermanentFailure } from '@lambda-event-router/s3'

const s3Router = createS3Router()

// S3 Batch route returns Succeeded, TemporaryFailure or PermanentFailure
s3Router.batchOperation({
  handler: async ({ bucket, key }) => {
    // Process the object
    return Succeeded()
  },
})
```

## Examples

See the [examples/s3](../../examples/s3) directory for complete working examples.

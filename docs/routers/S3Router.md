# S3Router

`S3Router` routes Amazon S3 events to handlers, either an object notification or a task from an S3
Batch Operations job.

A notification tells you something happened to an object, so you register a route per event name and
the router hands one record at a time to the handler that matches it. A batch job is the other
direction: it works through a manifest and calls your function per object, expecting a result back for
each one. Both arrive on the same router.

## Install

```bash
npm install @lambda-event-router/s3
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

## Create the router

```ts
import { createS3Router } from '@lambda-event-router/s3'
import { logInvocation } from './middleware/logInvocation'

const s3Router = createS3Router({
  middleware: [logInvocation],  // Optional
})
```

`middleware` is the only option, so `createS3Router()` on its own is what you want most of the time.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `S3Middleware[]` | No | `[]` | Runs for every notification record this router handles, before any route middleware. Batch routes do not get it. See [Middleware](#middleware) |

## Register routes

```ts
s3Router.route({
  filters: {
    eventName: 'ObjectCreated:Put',
    bucket: UPLOADS_BUCKET,
    key: 'uploads/*.csv',
  },
  middleware: [withUploadContext],  // Optional
  handler: processUpload,
})
```

`filters` and `handler` are the only required keys. A notification carries metadata about an object
rather than a payload you control, so there is nothing to validate and a route takes no schemas.

`route()` returns the router, so you can chain registrations.

```ts
s3Router.route(processUploadRoute).route(archiveUploadRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A record that matches no route throws.** S3 invokes your function asynchronously, so Lambda retries
the event twice by default and then drops it unless the function has an on-failure destination or a
dead letter queue. Register a catch-all route filtering only on `bucket` if you would rather swallow
the events you have not written a handler for, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

### Convenience methods

Each one fills in the `eventName` filter and types the handler for the event it sets, so they are the
shortest way to register a route and the only way to get the right request type. There are 23 of them,
covering the object, lifecycle, tagging and ACL events, with a wildcard method per family alongside the
specific ones.

```ts
// Both of these register the same route
s3Router.objectCreatedPut({
  filters: { bucket: UPLOADS_BUCKET },
  handler: processUpload,
})

s3Router.route({
  filters: { eventName: 'ObjectCreated:Put', bucket: UPLOADS_BUCKET },
  handler: processUpload,
})
```

| Method | Sets `eventName` to | Request |
| --- | --- | --- |
| `objectCreated()` | `ObjectCreated:*` | `S3ObjectCreatedRequest` |
| `objectCreatedPut()` | `ObjectCreated:Put` | `S3ObjectCreatedRequest` |
| `objectCreatedPost()` | `ObjectCreated:Post` | `S3ObjectCreatedRequest` |
| `objectCreatedCopy()` | `ObjectCreated:Copy` | `S3ObjectCreatedRequest` |
| `objectCreatedCompleteMultipartUpload()` | `ObjectCreated:CompleteMultipartUpload` | `S3ObjectCreatedRequest` |
| `objectRemoved()` | `ObjectRemoved:*` | `S3ObjectRemovedRequest` |
| `objectRemovedDelete()` | `ObjectRemoved:Delete` | `S3ObjectRemovedRequest` |
| `objectRemovedDeleteMarkerCreated()` | `ObjectRemoved:DeleteMarkerCreated` | `S3ObjectRemovedRequest` |
| `objectRestore()` | `ObjectRestore:*` | `S3ObjectRestoreRequest` |
| `objectRestorePost()` | `ObjectRestore:Post` | `S3ObjectRestoreRequest` |
| `objectRestoreCompleted()` | `ObjectRestore:Completed` | `S3ObjectRestoreRequest` |
| `objectRestoreDelete()` | `ObjectRestore:Delete` | `S3ObjectRestoreRequest` |
| `lifecycleExpiration()` | `LifecycleExpiration:*` | `S3LifecycleExpirationRequest` |
| `lifecycleExpirationDelete()` | `LifecycleExpiration:Delete` | `S3LifecycleExpirationRequest` |
| `lifecycleExpirationDeleteMarkerCreated()` | `LifecycleExpiration:DeleteMarkerCreated` | `S3LifecycleExpirationRequest` |
| `lifecycleTransition()` | `LifecycleTransition` | `S3LifecycleTransitionRequest` |
| `objectTagging()` | `ObjectTagging:*` | `S3ObjectTaggingRequest` |
| `objectTaggingPut()` | `ObjectTagging:Put` | `S3ObjectTaggingRequest` |
| `objectTaggingDelete()` | `ObjectTagging:Delete` | `S3ObjectTaggingRequest` |
| `objectAclPut()` | `ObjectAcl:Put` | `S3ObjectAclRequest` |
| `reducedRedundancyLostObject()` | `ReducedRedundancyLostObject` | `S3ReducedRedundancyLostObjectRequest` |
| `intelligentTiering()` | `IntelligentTiering` | `S3IntelligentTieringRequest` |

`filters` is optional on all of them, since the method has already set the one filter a route needs to
be useful. `s3Router.objectRemoved({ handler: onRemoved })` takes every delete in every bucket the
function is wired to.

**A convenience method's filters omit `eventName`.** The method sets it for you, so passing an
`eventName` there is a type error rather than something you have to remember not to do. Match on
`bucket`, `key` or a `custom` instead, and reach for `route()` when you need to set `eventName`
yourself. See [convenience methods](/docs/routing#convenience-methods) for how the other routers use
them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the records you want and leave the rest off.

```ts
s3Router.route({
  filters: {
    eventName: ['ObjectCreated:Put', 'ObjectCreated:Copy'],
    bucket: UPLOADS_BUCKET, // Or a pattern: /-uploads$/
    key: ['uploads/*.csv', '*/reports/*'],
    custom: ({ record }) => record.s3.object.size >= LARGE_UPLOAD_BYTES,
  },
  handler: processUpload,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `eventName` | `FilterStringMatcher` | Matches the record's event name, `ObjectCreated:Put` and so on |
| `bucket` | `FilterStringMatcher` | Matches the name of the bucket the event came from |
| `key` | `FilterStringMatcher` | Matches the object key, URL-decoded and matched whole |
| `custom` | `(input: S3FilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express, given `bucket`, `key`, `eventName` and `record`. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**The event name arrives without the `s3:` prefix.** You write `s3:ObjectCreated:Put` when you
configure the bucket notification, and the record carries `ObjectCreated:Put`, which is what the filter
matches.

**`key` is matched whole, so a bare prefix matches nothing.** `key: 'uploads/'` never fires against
`uploads/report.csv`. Write `uploads/*` for a prefix, `*.csv` for a suffix and `*draft*` for a
substring. There is one `key` filter rather than separate prefix and suffix options, so `*` is how you
build both.

The bucket notification configuration has its own prefix and suffix filters, and they run before your
function is invoked at all. Filtering there keeps the invocation from happening, filtering here decides
which handler takes it.

**`custom` sees the record before the request is built**, so it reads `record.s3.object` rather
than the `objectSize` and `eTag` a handler gets. See [`custom`](/docs/routing#custom) for
where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { S3ObjectCreatedRequest } from '@lambda-event-router/s3'

export async function processUpload(request: S3ObjectCreatedRequest): Promise<void> {
  const { bucket, key, objectSize } = request
  logger.info(`Processing ${key} from ${bucket}, ${objectSize} bytes`)
}
```

### Request object

Every event gets these.

| Field | Type | Description |
| --- | --- | --- |
| `bucket` | `string` | The name of the bucket the event came from |
| `key` | `string` | The object key, URL-decoded, so `my+file.txt` reaches you as `my file.txt` |
| `eventName` | `string` | The event name, without the `s3:` prefix |
| `eventTime` | `string` | When S3 finished processing the request, ISO 8601 |
| `versionId` | `string \| undefined` | The object version, set on a versioning-enabled bucket |
| `record` | `S3EventRecord` | The untouched record from AWS, for `sequencer`, `userIdentity` and anything else you need |
| `context` | `Context` | The Lambda context |

ObjectCreated and ObjectRestore events carry more.

| Field | Type | On | Description |
| --- | --- | --- | --- |
| `objectSize` | `number` | `ObjectCreated:*` | The object size in bytes |
| `eTag` | `string` | `ObjectCreated:*` | The object entity tag |
| `restoreEventData` | `S3EventRecordGlacierRestoreEventData \| undefined` | `ObjectRestore:*` | When the restored copy expires and which storage class it came from. AWS only fills it in on `ObjectRestore:Completed` |

`S3EventRecord`, `S3EventRecordGlacierRestoreEventData` and `Context` come from `aws-lambda`, not from
this package.

Notifications are not guaranteed to arrive in the order the events happened.
`record.s3.object.sequencer` is how you tell, on PUT and DELETE events for a single key. Compare two
`sequencer` strings by left-padding the shorter with zeros first.

### Response type

Handlers return `Promise<void>`. There is nothing useful to hand back from a notification, so there is
no response type to import and nothing for the router to do with a return value.

Throwing is how you signal failure. See [Failures and retries](#failures-and-retries) for what that
does to the rest of the event.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineRoute` builds the request type for you, so
`objectSize` below is a `number` without you naming a type anywhere.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/s3'

export const processUploadRoute = defineRoute({
  filters: {
    eventName: 'ObjectCreated:*',
    bucket: UPLOADS_BUCKET,
    key: 'uploads/*.csv',
  },
}).handle(async ({ bucket, key, objectSize }) => {
  logger.info(`Processing ${key} from ${bucket}, ${objectSize} bytes`)
})

s3Router.route(processUploadRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

**`defineRoute` types every handler as an ObjectCreated request.** `objectSize` and `eTag` are on the
inferred request whatever you filter for, and the router only sets them on `ObjectCreated:` events, so
a route filtered to `ObjectRemoved:Delete` gets both as `undefined` while the type promises a `number`
and a `string`. Use the [convenience method](#convenience-methods) for the event you want, which types
the handler from the event it sets.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using the request type for the
event and your own filters.

```ts
// handlers/onRestored.ts
import { logger } from '@lambda-event-router/base'
import type { S3ObjectRestoreRequest } from '@lambda-event-router/s3'

export async function onRestored(request: S3ObjectRestoreRequest): Promise<void> {
  const expiry = request.restoreEventData?.lifecycleRestorationExpiryTime
  logger.info(`${request.key} restored, copy expires ${expiry}`)
}
```

```ts
// s3.ts
import { createS3Router } from '@lambda-event-router/s3'
import { onRestored } from './handlers/onRestored'

const s3Router = createS3Router()

s3Router.objectRestoreCompleted({
  filters: { bucket: ARCHIVE_BUCKET },
  handler: onRestored,
})
```

Registering through the convenience method rather than `route()` is what gets `restoreEventData` onto
the request type here. `route()` accepts a handler annotated with any of the request types, so it
compiles either way, but it types the handler it hands you as an ObjectCreated request. See [annotated
handlers](/docs/handlers#annotated-handlers) for the worked version.

## Failures and retries

Records run one at a time in the order they arrive, and the first throw ends the invocation. Anything
left in the event is never handled, and a record that already succeeded is not rolled back.

S3 invokes your function asynchronously, so a throw means Lambda retries the whole event. The default
is two retries, then the event is dropped unless the function has an on-failure destination or a dead
letter queue. `MaximumRetryAttempts` and `MaximumEventAge` are how you narrow that.

Notifications are delivered at least once, so the same event can arrive twice even when nothing failed.
Handlers want to be idempotent whichever way you set retries up.

## Test event

When you first wire up a bucket notification, S3 sends a single `s3:TestEvent` to confirm the plumbing
works. It arrives before any real object event and carries no `Records`, so none of the notification
routes match it.

Register a handler with `testEvent()` to react to it, for example to log the setup or prime something
the later events depend on. There is only ever one, and calling `testEvent()` again replaces it.

```ts
s3Router.testEvent({
  handler: async ({ bucket, time }) => {
    logger.info(`Notifications live on ${bucket} from ${time}`)
  },
})
```

The request is mapped from the raw event, in the same camelCase shape as the other requests.

| Field | Type | Description |
| --- | --- | --- |
| `bucket` | `string` | The bucket the notification is configured on |
| `time` | `string` | When S3 sent the event |
| `requestId` | `string` | The request ID from S3 |
| `hostId` | `string` | The host ID from S3 |
| `context` | `Context` | The Lambda context |

Skip `testEvent()` and the router still claims the test event and returns without doing anything, so
the invocation succeeds rather than failing with no matching route.

## Batch operations

An S3 Batch Operations job works through a manifest and invokes your function once per object. The job
already decided which objects it is sending, so a batch route takes no filters. There is only ever one
of them, and calling `batchOperation()` again replaces the route rather than adding a second.

An invocation can carry more than one task. The router runs the handler for each and returns a result
per task, so one task failing does not stop the rest.

```ts
import { logger } from '@lambda-event-router/base'
import { createS3Router, PermanentFailure, Succeeded } from '@lambda-event-router/s3'

const s3Router = createS3Router()

s3Router.batchOperation({
  middleware: [logBatchTask],  // Optional
  handler: async ({ bucket, key, versionId }) => {
    if (!key.endsWith('.csv')) return PermanentFailure(`${key} is not a CSV`)

    logger.info(`Converting ${key} from ${bucket}, version ${versionId ?? 'latest'}`)
    return Succeeded(`Converted ${key}`)
  },
})
```

The request is a task rather than a record.

| Field | Type | Description |
| --- | --- | --- |
| `taskId` | `string` | The task's ID, which the router puts in the result for you |
| `bucket` | `string` | Taken off the task's `s3BucketArn` |
| `key` | `string` | The object key, URL-decoded |
| `versionId` | `string \| null` | The object version from the manifest |
| `task` | `S3BatchEventTask` | The untouched task from AWS |
| `event` | `S3BatchEvent` | The whole invocation, for `job.id` and `invocationId` |
| `context` | `Context` | The Lambda context |

Return one of three helpers, which build the `S3BatchResponse` the job expects. The router wraps it in
the result envelope, so there is nothing to assemble yourself.

| Helper | What the job does with it |
| --- | --- |
| `Succeeded(resultString?)` | Counts the task as done. The string lands in the completion report |
| `TemporaryFailure(resultString?)` | Redrives the task before the job finishes. The string is only reported if the last redrive fails |
| `PermanentFailure(resultString?)` | Marks the task failed and reports the string |

Throwing one of them works too, so code well below the handler can fail a task without threading a
return value back up. Any other error is rethrown and fails the invocation.

```ts
if (!(await bucketIsWritable(bucket))) throw PermanentFailure('destination is read only')
```

The result envelope carries a `treatMissingKeysAs` field, which tells the job how to count any task it
sent that your response leaves out. The router returns a result for every task it runs, so this only
comes into play if a task never reaches the handler.

It defaults to `PermanentFailure`. Set it on the route when you want the job to treat a missing task as
something else.

```ts
s3Router.batchOperation({
  treatMissingKeysAs: 'TemporaryFailure',
  handler: async ({ key }) => Succeeded(`Converted ${key}`),
})
```

**A batch event with no `batchOperation()` route throws.** The router has nothing to answer with, and a
notification route cannot stand in because the two take different requests and return different things.

## Middleware

Notification middleware is typed `S3Middleware` and runs once per record, so an event carrying three
records runs it three times. Batch middleware is typed `S3BatchMiddleware`, because a task is not a
record and the handler returns a result rather than nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { S3BatchMiddleware, S3Middleware } from '@lambda-event-router/s3'

export const logInvocation: S3Middleware = async (request, next) => {
  logger.info(`${request.eventName} on ${request.bucket}/${request.key}`)
  return next(request)
}

export const logBatchTask: S3BatchMiddleware = async (request, next) => {
  const response = await next(request)
  logger.info(`Task ${request.taskId} finished ${response.resultCode}`)
  return response
}
```

```ts
const s3Router = createS3Router({ middleware: [logInvocation] })

s3Router.objectCreatedPut({
  filters: { bucket: UPLOADS_BUCKET },
  middleware: [withUploadContext],
  handler: processUpload,
})
```

**Router middleware does not reach a batch route.** It is typed for a notification request, so a batch
task would never satisfy it, and anything you need on both sides goes on each route rather than on the
router. See [middleware](/docs/middleware) for the execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/s3`. None of them take generic parameters, so there is nothing
to pass and nothing that falls back to a default.

The request your handler gets:

| Type | Description |
| --- | --- |
| `S3BaseRequest` | The fields every notification carries, and the request for every event bar the two below |
| `S3ObjectCreatedRequest` | Adds `objectSize` and `eTag` |
| `S3ObjectRestoreRequest` | Adds `restoreEventData` |
| `S3ObjectRemovedRequest`, `S3ObjectTaggingRequest`, `S3ObjectAclRequest`, `S3LifecycleExpirationRequest`, `S3LifecycleTransitionRequest`, `S3IntelligentTieringRequest`, `S3ReducedRedundancyLostObjectRequest` | Named aliases for `S3BaseRequest`, one per event family, so a handler signature says which event it is for |

Routes and filters:

| Type | Description |
| --- | --- |
| `S3Filters` | The `filters` object |
| `S3FilterInput` | What `custom` receives |
| `S3RouterOptions` | Options for `createS3Router` |
| `S3Middleware` | Router and route middleware for notifications |
| `S3ObjectCreatedRouteDefinition` | A full route passed to `route()` |
| `S3ObjectCreatedConvenienceRouteDefinition` | A route passed to one of the `objectCreated*()` methods |
| `S3ObjectRemovedRouteDefinition`, `S3ObjectRestoreRouteDefinition`, `S3ObjectTaggingRouteDefinition`, `S3ObjectAclRouteDefinition`, `S3LifecycleExpirationRouteDefinition`, `S3LifecycleTransitionRouteDefinition`, `S3IntelligentTieringRouteDefinition`, `S3ReducedRedundancyLostObjectRouteDefinition` | A route passed to the matching convenience method |
| `S3ObjectCreatedHandler`, `S3ObjectRemovedHandler`, `S3ObjectRestoreHandler`, `S3ObjectTaggingHandler`, `S3ObjectAclHandler`, `S3LifecycleExpirationHandler`, `S3LifecycleTransitionHandler`, `S3IntelligentTieringHandler`, `S3ReducedRedundancyLostObjectHandler` | The handler each route definition takes |

Batch operations:

| Type | Description |
| --- | --- |
| `S3BatchRequest` | The batch handler argument |
| `S3BatchResponse` | What a batch handler returns, `{ resultCode, resultString? }` |
| `S3BatchHandler` | The batch handler |
| `S3BatchMiddleware` | Batch route middleware |
| `S3BatchRouteDefinition` | The object passed to `batchOperation()` |
| `S3BatchEvent`, `S3BatchEventJob`, `S3BatchEventTask`, `S3BatchResult`, `S3BatchResultResult`, `S3BatchResultResultCode` | Re-exported from `aws-lambda` so you do not need both imports |

Test event:

| Type | Description |
| --- | --- |
| `S3TestEvent` | The raw `s3:TestEvent` shape S3 sends |
| `S3TestEventRequest` | The mapped request your handler gets |
| `S3TestEventHandler` | The test event handler |
| `S3TestEventRouteDefinition` | The object passed to `testEvent()` |

Event names, as a type and a matching array of the values:

| Type | Constant |
| --- | --- |
| `S3ObjectCreatedEventName` | `OBJECT_CREATED_EVENT_NAMES` |
| `S3ObjectRemovedEventName` | `OBJECT_REMOVED_EVENT_NAMES` |
| `S3ObjectRestoreEventName` | `OBJECT_RESTORE_EVENT_NAMES` |
| `S3LifecycleExpirationEventName` | `LIFECYCLE_EXPIRATION_EVENT_NAMES` |
| `S3LifecycleTransitionEventName` | `LIFECYCLE_TRANSITION_EVENT_NAMES` |
| `S3ObjectTaggingEventName` | `OBJECT_TAGGING_EVENT_NAMES` |
| `S3ObjectAclEventName` | `OBJECT_ACL_EVENT_NAMES` |
| `S3IntelligentTieringEventName` | `INTELLIGENT_TIERING_EVENT_NAMES` |
| `S3ReducedRedundancyLostObjectEventName` | `REDUCED_REDUNDANCY_LOST_OBJECT_EVENT_NAMES` |

The `eventName` filter takes any `FilterStringMatcher`, so these are for your own code rather than
something the router asks for. `isS3BatchResponse`, the `Succeeded`, `TemporaryFailure` and
`PermanentFailure` helpers, the `S3Router` class and the `createS3Router` and `defineRoute` functions
all come from the same place.

## Code example

An uploads bucket feeding one Lambda, with CSVs and images going to their own handlers, deletes tidying
up derived files and a batch route that reprocesses the backlog from a manifest.

Open a file: [index.ts](#s3-example:index.ts) | [S3 router](#s3-example:s3.ts) | [notification handlers](#s3-example:handlers/uploads.ts) | [batch handler](#s3-example:handlers/reprocess.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { s3Router } from './s3.js'

const lambdaRouter = new LambdaRouter({
  routers: [s3Router],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 's3.ts',
    code: `import { createS3Router } from '@lambda-event-router/s3'

import { onUploadRemoved, processImage, processReport } from './handlers/uploads.js'
import { reprocessReport } from './handlers/reprocess.js'

const UPLOADS_BUCKET = 'acme-uploads'

export const s3Router = createS3Router()

s3Router
  .objectCreatedPut({
    filters: { bucket: UPLOADS_BUCKET, key: 'reports/*.csv' },
    handler: processReport,
  })
  .objectCreatedPut({
    filters: { bucket: UPLOADS_BUCKET, key: ['images/*.jpg', 'images/*.png'] },
    handler: processImage,
  })
  .objectRemoved({
    filters: { bucket: UPLOADS_BUCKET },
    handler: onUploadRemoved,
  })
  .batchOperation({
    handler: reprocessReport,
  })`,
  },
  {
    path: 'handlers/uploads.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { S3ObjectCreatedRequest, S3ObjectRemovedRequest } from '@lambda-event-router/s3'

export async function processReport(request: S3ObjectCreatedRequest): Promise<void> {
  const { key, objectSize } = request
  logger.info(\`Parsing report \${key}, \${objectSize} bytes\`)
}

export async function processImage(request: S3ObjectCreatedRequest): Promise<void> {
  const { key, eTag } = request
  logger.info(\`Generating thumbnails for \${key}, eTag \${eTag}\`)
}

export async function onUploadRemoved(request: S3ObjectRemovedRequest): Promise<void> {
  logger.info(\`Deleting anything derived from \${request.key}\`)
}`,
  },
  {
    path: 'handlers/reprocess.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { S3BatchRequest, S3BatchResponse } from '@lambda-event-router/s3'
import { PermanentFailure, Succeeded } from '@lambda-event-router/s3'

export async function reprocessReport(request: S3BatchRequest): Promise<S3BatchResponse> {
  const { bucket, key } = request

  if (!key.endsWith('.csv')) {
    return PermanentFailure(\`\${key} is not a report\`)
  }

  logger.info(\`Reprocessing \${key} from \${bucket}\`)
  return Succeeded(\`Reprocessed \${key}\`)
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="s3-example" default-file="s3.ts" line-numbers collapse-toggle fixed-height />

The two `objectCreatedPut()` routes take different key patterns and the delete route takes a different
event, so no record can match more than one and the order they are registered in makes no difference.

Both upload routes go through a convenience method rather than `route()`, which is what types
`objectSize` and `eTag` onto the request `processReport` and `processImage` are handed.

The batch route sits on the same router and the same Lambda as the notification routes, and the router
tells the two event shapes apart for you. Nothing about the notification routes affects which task the
batch job sends.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

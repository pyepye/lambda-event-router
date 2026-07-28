# S3Router

`S3Router` routes Amazon S3 object notifications to handlers, one record at a time.

A notification tells you something happened to an object, so you register a route per event name and
the router hands each record to the handler that matches it.

An S3 Batch Operations job is a different trigger and has its own router. See
[S3BatchRouter](/routers/S3BatchRouter).

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/s3
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createS3Router } from '@lambda-event-router/s3'
import { logInvocation } from './middleware/logInvocation'

const s3Router = createS3Router({
  middleware: [logInvocation],  // Optional
})
```

`middleware` is the only option and it can be left out. `createS3Router()` on its own gives you a
router with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `S3Middleware[]` | No | `[]` | Runs for every record this router handles, before any route middleware. See [Middleware](#middleware) |

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

Routes are ranked by how specific they are. Where two overlap, the one matching only a subset of the
other is tried first, whatever order you registered them in. Registration order decides the rest, so give
each route filters no other route can match. See [match order](/docs/routing#match-order) for how ranking
works and what it cannot settle.

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
| `eventName` | `S3EventName \| S3EventName[]` | Matches the record's event name, `ObjectCreated:Put` and so on |
| `bucket` | `FilterStringMatcher` | Matches the name of the bucket the event came from |
| `key` | `FilterStringMatcher` | Matches the object key, URL-decoded and matched whole |
| `custom` | `(input: S3FilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express, given `bucket`, `key`, `eventName` and `record`. Can be async |

`bucket`, `key` and `custom` take a `FilterStringMatcher`, which is
`string | RegExp | Array<string | RegExp>`. See [filters](/docs/routing#filters) for how each form
matches, including the `*` wildcard.

**`eventName` is the exception, and takes only names S3 uses.** `S3EventName` is the union of all
nine families, so `eventName: 'ObjectCreated:Putt'` is a compile error rather than a route that
matches nothing. Each family's wildcard is one of the names, so `'ObjectCreated:*'` still works.
A pattern S3 never publishes, such as `'Object*'`, does not. Reach for `custom` when you need to
match across families.

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
the later events depend on. There is only ever one, and calling `testEvent()` a second time throws.

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

## Middleware

Middleware is typed `S3Middleware` and runs once per record, so an event carrying three records runs
it three times.

```ts
import { logger } from '@lambda-event-router/base'
import type { S3Middleware } from '@lambda-event-router/s3'

export const logInvocation: S3Middleware = async (request, next) => {
  logger.info(`${request.eventName} on ${request.bucket}/${request.key}`)
  return next(request)
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

See [middleware](/docs/middleware) for the execution order and the three levels it attaches at.

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
| `S3EventName` | The union of all nine below, and what the `eventName` filter takes |
| `S3ObjectCreatedEventName` | `OBJECT_CREATED_EVENT_NAMES` |
| `S3ObjectRemovedEventName` | `OBJECT_REMOVED_EVENT_NAMES` |
| `S3ObjectRestoreEventName` | `OBJECT_RESTORE_EVENT_NAMES` |
| `S3LifecycleExpirationEventName` | `LIFECYCLE_EXPIRATION_EVENT_NAMES` |
| `S3LifecycleTransitionEventName` | `LIFECYCLE_TRANSITION_EVENT_NAMES` |
| `S3ObjectTaggingEventName` | `OBJECT_TAGGING_EVENT_NAMES` |
| `S3ObjectAclEventName` | `OBJECT_ACL_EVENT_NAMES` |
| `S3IntelligentTieringEventName` | `INTELLIGENT_TIERING_EVENT_NAMES` |
| `S3ReducedRedundancyLostObjectEventName` | `REDUCED_REDUNDANCY_LOST_OBJECT_EVENT_NAMES` |

The `eventName` filter takes `S3EventName`, so a name outside it is a compile error. The per-family
types narrow that further, for a helper or a variable you want held to one family.
The `S3Router` class and the `createS3Router` and `defineRoute` functions come from the same place.

## Code example

An uploads bucket feeding one Lambda, with CSVs and images going to their own handlers, deletes tidying
up derived files, and a batch router reprocessing the backlog from a manifest.

Open a file: [index.ts](#s3-example:index.ts) | [S3 router](#s3-example:s3.ts) | [batch router](#s3-example:s3Batch.ts) | [notification handlers](#s3-example:handlers/uploads.ts) | [batch handler](#s3-example:handlers/reprocess.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { s3BatchRouter } from './s3Batch.js'
import { s3Router } from './s3.js'

const lambdaRouter = new LambdaRouter({
  routers: [s3Router, s3BatchRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 's3.ts',
    code: `import { createS3Router } from '@lambda-event-router/s3'

import { onUploadRemoved, processImage, processReport } from './handlers/uploads.js'

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
  })`,
  },
  {
    path: 's3Batch.ts',
    code: `import { createS3BatchRouter } from '@lambda-event-router/s3'

import { reprocessReport } from './handlers/reprocess.js'

export const s3BatchRouter = createS3BatchRouter().route({
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

The batch router sits on the same Lambda as the notification routes, and each takes only its own
events. See [S3BatchRouter](/routers/S3BatchRouter) for what a batch handler returns.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

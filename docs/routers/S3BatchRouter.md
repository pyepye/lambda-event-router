# S3BatchRouter

`S3BatchRouter` routes the tasks of an S3 Batch Operations job to a handler.

A job works through a manifest and invokes your function once per object, expecting a result back for
each one. The router runs your handler per task and assembles the result envelope the job reads.

For object notifications, which are a different trigger entirely, see
[S3Router](/routers/S3Router).

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/s3
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createS3BatchRouter } from '@lambda-event-router/s3'
import { logBatchTask } from './middleware/logBatchTask'

const s3BatchRouter = createS3BatchRouter({
  middleware: [logBatchTask],  // Optional
})
```

`middleware` is the only option and it can be left out. `createS3BatchRouter()` on its own gives you a
router with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `S3BatchMiddleware[]` | No | `[]` | Runs for every task, before any route middleware. See [Middleware](#middleware) |

## Register the route

The job already decided which objects it is sending, so the route takes no filters. There is only ever
one of them, and calling `route()` a second time throws.

```ts
import { logger } from '@lambda-event-router/base'
import { createS3BatchRouter, PermanentFailure, Succeeded } from '@lambda-event-router/s3'

const s3BatchRouter = createS3BatchRouter()

s3BatchRouter.route({
  middleware: [logBatchTask],  // Optional
  handler: async ({ bucket, key, versionId }) => {
    if (!key.endsWith('.csv')) return PermanentFailure(`${key} is not a CSV`)

    logger.info(`Converting ${key} from ${bucket}, version ${versionId ?? 'latest'}`)
    return Succeeded(`Converted ${key}`)
  },
})
```

An invocation can carry more than one task. The router runs the handler for each and returns a result
per task, so one task failing does not stop the rest.

**A batch event with no route throws.** The router has nothing to answer with, and the job reads a
missing response as a failure of the whole invocation.

## Handler

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `taskId` | `string` | The task's ID, which the router puts in the result for you |
| `bucket` | `string` | The bucket name, whichever schema the job uses |
| `key` | `string` | The object key, URL-decoded |
| `versionId` | `string \| null` | The object version from the manifest |
| `userArguments` | `Record<string, string> \| undefined` | What the job passed, on schema 2.0 only |
| `task` | `S3BatchAnyEventTask` | The untouched task from AWS |
| `event` | `S3BatchAnyEvent` | The whole invocation, for `job.id` and `invocationId` |
| `context` | `Context` | The Lambda context |

### Response type

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

### Missing tasks

The result envelope carries a `treatMissingKeysAs` field, which tells the job how to count any task it
sent that your response leaves out. The router returns a result for every task it runs, so this only
comes into play if a task never reaches the handler.

It defaults to `PermanentFailure`. Set it on the route when you want the job to treat a missing task as
something else.

```ts
s3BatchRouter.route({
  treatMissingKeysAs: 'TemporaryFailure',
  handler: async ({ key }) => Succeeded(`Converted ${key}`),
})
```

## Schema versions

A job picks its payload schema at creation time with `InvocationSchemaVersion`. Version 1.0 is the
default. Version 2.0 is required for a job on a directory bucket, and for any job passing
`UserArguments`.

The router takes both and hands your handler the same request either way, so `bucket`, `key` and
`versionId` read the same whichever arrived.

| | 1.0 | 2.0 |
| --- | --- | --- |
| Task names the bucket with | `s3BucketArn`, an ARN | `s3Bucket`, a plain name |
| `job` carries | `id` | `id` and `userArguments` |
| Type for the event | `S3BatchEvent`, from `aws-lambda` | `S3BatchV2Event`, from this package |

`aws-lambda` declares no 2.0 types, which is why the 2.0 shapes are exported from here. Narrow on
`invocationSchemaVersion` before reading anything version specific off `request.event`.

```ts
const version = request.event.invocationSchemaVersion
```

The result envelope echoes back whichever version the job sent, so there is nothing to set.

## Failures and retries

A result code is how you fail one task. `TemporaryFailure` and `PermanentFailure` both let the rest of
the invocation finish, and the job reads the code from the result envelope.

Anything else is different. Tasks run one at a time in the order the job sent them, and an error that
is not one of the three helpers ends the invocation. Every result collected so far is discarded, so a
task that already succeeded runs again when S3 retries.

S3 Batch invokes your function synchronously and retries a failed invocation, then marks the whole
invocation failed once it runs out of attempts. A job stops when its failure rate passes 50%, so a bug
that throws on every task ends the job rather than working through the manifest.

Handlers want to be idempotent either way, because a redrive from `TemporaryFailure` runs the task
again.

## Middleware

Middleware is typed `S3BatchMiddleware`. A task is not a notification record, and the handler returns a
result rather than nothing, so it cannot share a list with `S3Middleware`.

```ts
import { logger } from '@lambda-event-router/base'
import type { S3BatchMiddleware } from '@lambda-event-router/s3'

export const logBatchTask: S3BatchMiddleware = async (request, next) => {
  const response = await next(request)
  logger.info(`Task ${request.taskId} finished ${response.resultCode}`)
  return response
}
```

Router middleware runs for every task, before any route middleware. See
[middleware](/docs/middleware) for the execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/s3`. None of them take generic parameters.

| Type | Description |
| --- | --- |
| `S3BatchRequest` | The handler argument |
| `S3BatchResponse` | What a handler returns, `{ resultCode, resultString? }` |
| `S3BatchHandler` | The handler |
| `S3BatchMiddleware` | Router and route middleware |
| `S3BatchRouteDefinition` | The object passed to `route()` |
| `S3BatchV2Event`, `S3BatchV2EventTask` | The schema 2.0 shapes, declared here because `aws-lambda` has none |
| `S3BatchAnyEvent`, `S3BatchAnyEventTask` | Either schema, which is what `request.event` and `request.task` are typed as |
| `S3BatchRouterOptions` | Options for `createS3BatchRouter` |
| `S3BatchEvent`, `S3BatchEventJob`, `S3BatchEventTask`, `S3BatchResult`, `S3BatchResultResult`, `S3BatchResultResultCode` | Re-exported from `aws-lambda` so you do not need both imports |

`Succeeded`, `TemporaryFailure`, `PermanentFailure` and `isS3BatchResponse` come from the same package.

## One Lambda for both

A job that reprocesses a backlog often wants the handlers that already process new uploads. Register
both routers and each takes its own events.

```ts
import { LambdaRouter } from '@lambda-event-router/base'

import { s3BatchRouter } from './s3Batch'
import { s3Router } from './s3'

const lambdaRouter = new LambdaRouter({ routers: [s3Router, s3BatchRouter] })

export const handler = lambdaRouter.handler()
```

The [S3Router code example](/routers/S3Router#code-example) is that Lambda in full, with the
notification routes and the batch route side by side.

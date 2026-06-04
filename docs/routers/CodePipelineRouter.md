# CodePipelineRouter

`CodePipelineRouter` routes a CodePipeline invoke action to a handler and reports the result back to
the pipeline for you.

A pipeline runs your Lambda as a custom action and waits. The router works out which of your routes
should handle the job, parses the action's user parameters, then calls `PutJobSuccessResult` or
`PutJobFailureResult` on your behalf so the stage moves on.

## Install

```bash
npm install @lambda-event-router/codepipeline
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

## Create the router

```ts
import { createCodePipelineRouter } from '@lambda-event-router/codepipeline'
import { logInvocation } from './middleware/logInvocation'

const codePipelineRouter = createCodePipelineRouter({
  middleware: [logInvocation],  // Optional
})
```

Both options can be left out. `createCodePipelineRouter()` on its own gives you a router that builds
its own `CodePipelineClient` to report results with.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `client` | `CodePipelineClient` | No | A new `CodePipelineClient` | The SDK client the router calls `PutJobSuccessResult` and `PutJobFailureResult` on. Pass your own to set a region or credentials, or to share one across a Lambda |
| `middleware` | `CodePipelineMiddleware[]` | No | `[]` | Runs for every job this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
codePipelineRouter.route({
  filters: {
    functionName: 'deploy',
    hasInputArtifacts: true,
  },
  userParametersSchema: DeployParametersSchema,  // Optional
  middleware: [withDeployContext],  // Optional
  handler: runDeploy,
})
```

`filters` and `handler` are required, though `filters` can be an empty object to match every job.

`route()` returns the router, so you can chain registrations.

```ts
codePipelineRouter.route(deployRoute).route(migrateRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other
route can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A job that matches no route reports failure to the pipeline and throws.** The stage fails with `No
route matched for CodePipeline job <id>` and the Lambda re-throws. Register a route with empty
`filters` as a catch-all if you would rather handle unrecognised actions yourself, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

### Convenience methods

`continuation()` sets the `hasContinuationToken` filter to `true` for you, so it only matches a job
that CodePipeline has re-invoked with a token. You pass everything except that key. The two calls
below register the same route.

```ts
codePipelineRouter.continuation({
  filters: { functionName: 'deploy' },
  handler: resumeDeploy,
})

codePipelineRouter.route({
  filters: { functionName: 'deploy', hasContinuationToken: true },
  handler: resumeDeploy,
})
```

| Method | Sets | Takes |
| --- | --- | --- |
| `continuation()` | `hasContinuationToken: true` | The filters without `hasContinuationToken`, plus `userParametersSchema`, `middleware` and `handler` |

`continuation()` drops the `hasContinuationToken` key from the filters you pass and sets it itself, so
putting it in the object is a type error. A long-running action returns a `continuationToken` from its
handler and CodePipeline re-invokes the Lambda with the same token, which is the job this route
catches. See [convenience methods](/docs/routing#convenience-methods) for how the other routers use
them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set
the ones that pick out the jobs you want and leave the rest off.

```ts
codePipelineRouter.route({
  filters: {
    functionName: ['deploy', 'migrate'], // Or a pattern: /^deploy-/
    hasInputArtifacts: true,
    hasContinuationToken: false,
    custom: ({ userParameters }) => isObject(userParameters) && userParameters.env === 'prod',
  },
  handler: runDeploy,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `functionName` | `FilterStringMatcher` | Matches against the `FunctionName` set on the action configuration |
| `hasInputArtifacts` | `boolean` | `true` matches a job that has input artifacts, `false` a job that has none |
| `hasContinuationToken` | `boolean` | `true` matches a re-invoked job carrying a continuation token, `false` a first invocation |
| `custom` | `(input: CodePipelineFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

`custom` is handed `functionName`, `hasInputArtifacts`, `hasContinuationToken` and the parsed
`userParameters`. **The user parameters have not been through your schema yet**, so they arrive typed
`unknown`. Narrow them with `isObject` from `@lambda-event-router/base` rather than reading straight
in. Since the built-in keys already cover the function name and the artifact and token flags, a
`custom` earns its place matching on `userParameters`, which nothing else reaches. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return either a result or nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { CodePipelineRequest, CodePipelineResponse } from '@lambda-event-router/codepipeline'

export async function runDeploy(request: CodePipelineRequest): Promise<CodePipelineResponse> {
  logger.info(`Running deploy job ${request.jobId}`)
  return { outputVariables: { status: 'deployed' } }
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `jobId` | `string` | The job ID, used when reporting the result back |
| `functionName` | `string` | The `FunctionName` from the action configuration |
| `userParameters` | `TUserParameters` | The `UserParameters` string, JSON parsed. Raw string if it is not JSON. Typed by your schema, otherwise `unknown` |
| `inputArtifacts` | `Artifact[]` | The input artifacts, each with a name and its S3 location |
| `outputArtifacts` | `Artifact[]` | The output artifacts the action is expected to produce |
| `artifactCredentials` | `Credentials` | Temporary credentials scoped to the artifact bucket |
| `continuationToken` | `string \| undefined` | The token from a previous run, set only on a re-invocation |
| `event` | `CodePipelineEvent` | The untouched event from AWS |
| `context` | `Context` | The Lambda context |

`Artifact`, `Credentials`, `CodePipelineEvent` and `Context` come from `aws-lambda`, not from this
package.

### Response type

`CodePipelineResponse` is `CodePipelineSuccessResult | undefined`. Return nothing and the router
reports the job succeeded. Return a result to hand values back to the pipeline.

```ts
return {
  outputVariables: { deployedRegion: 'eu-west-2' },  // Available to later actions
  continuationToken: 'step-2',  // Re-invoke this action with the token
}
```

Both keys are optional. `outputVariables` become available to later actions in the pipeline, and a
`continuationToken` tells CodePipeline to invoke the action again rather than treat it as done. See
[Responses](#responses) for what the router does with the return value and how a throw is reported.

**To return nothing from a handler you pass to `route()`, write an explicit `return`.** An async
handler with no return statement is typed `Promise<void>`, which `route()` rejects. A handler you
build with `defineRoute().handle()` can leave the return off, since `handle()` accepts a void body.

### Inferred handlers

Attach a `userParametersSchema` and `defineRoute` types `userParameters` from it, so `environment`
below is a `string` without you declaring that anywhere.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/codepipeline'
import { z } from 'zod'

const DeployParametersSchema = z.object({ environment: z.string(), region: z.string() })

export const deployRoute = defineRoute({
  filters: { functionName: 'deploy' },
  userParametersSchema: DeployParametersSchema,
}).handle(async ({ jobId, userParameters }) => {
  logger.info(`Deploying job ${jobId} to ${userParameters.environment}`)
  return { outputVariables: { region: userParameters.region } }
})

codePipelineRouter.route(deployRoute)
```

Not knowing the request shape pays off most in a Lambda taking several event sources, since you never
have to look any of them up. See [inferred handlers](/docs/handlers#inferred-handlers), where the same
source is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`CodePipelineRequest`](#generic-parameters) and the type of your parsed user parameters.

```ts
// handlers/runDeploy.ts
import { logger } from '@lambda-event-router/base'
import type { CodePipelineRequest, CodePipelineResponse } from '@lambda-event-router/codepipeline'
import { z } from 'zod'

export const DeployParametersSchema = z.object({ environment: z.string(), region: z.string() })
type DeployParameters = z.infer<typeof DeployParametersSchema>

export async function runDeploy(
  request: CodePipelineRequest<DeployParameters>,
): Promise<CodePipelineResponse> {
  logger.info(`Deploying job ${request.jobId} to ${request.userParameters.environment}`)
  return { outputVariables: { region: request.userParameters.region } }
}
```

```ts
// codepipeline.ts
import { createCodePipelineRouter } from '@lambda-event-router/codepipeline'
import { DeployParametersSchema, runDeploy } from './handlers/runDeploy'

const codePipelineRouter = createCodePipelineRouter()

codePipelineRouter.route({
  filters: { functionName: 'deploy' },
  userParametersSchema: DeployParametersSchema,
  handler: runDeploy,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
See [annotated handlers](/docs/handlers#annotated-handlers) for the worked version.

## Schema validation

`userParametersSchema` is the only schema key, and it is optional. It validates the parsed
`UserParameters` after a route has matched.

```ts
const DeployParametersSchema = z.object({
  environment: z.enum(['staging', 'production']),
  region: z.string(),
})

codePipelineRouter.route({
  filters: { functionName: 'deploy' },
  userParametersSchema: DeployParametersSchema,
  handler: runDeploy,
})
```

| Key | Validates |
| --- | --- |
| `userParametersSchema` | The `UserParameters` string after JSON parsing |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after the route
matches and before any middleware, so a job whose parameters fail their schema reports failure to the
pipeline and throws, without the handler running. See [schema validation](/docs/routing#schema-validation)
for what your handler receives after coercion.

## Responses

The router reports the outcome of every job back to CodePipeline, so the pipeline stage never hangs
waiting on your Lambda.

When the handler returns, the router calls `PutJobSuccessResult` with the job ID. A returned
`outputVariables` map and `continuationToken` are passed along, and returning nothing sends just the
job ID.

When the handler throws, the router calls `PutJobFailureResult` with the error message as the failure
detail, then re-throws so the invocation fails and Lambda records the error. A no-match and a schema
failure are reported the same way, since both throw before the handler runs. If the report call
itself fails the router swallows that error and still re-throws the original, so the real cause
reaches your logs.

A `continuationToken` in the success result is how a long-running action tells CodePipeline it is not
finished. The pipeline re-invokes the Lambda with the same token, and the [`continuation()`](#convenience-methods)
route is where you pick that invocation back up.

## Middleware

Router and route middleware are both typed `CodePipelineMiddleware`, and the chain runs once per job.
Middleware wraps the handler, so it can read the result the handler returns and change what the router
reports.

```ts
import { logger } from '@lambda-event-router/base'
import type { CodePipelineMiddleware } from '@lambda-event-router/codepipeline'

export const logInvocation: CodePipelineMiddleware = async (request, next) => {
  logger.info(`Handling job ${request.jobId} for ${request.functionName}`)
  return next(request)
}
```

```ts
const codePipelineRouter = createCodePipelineRouter({ middleware: [logInvocation] })

codePipelineRouter.route({
  filters: { functionName: 'deploy' },
  middleware: [withDeployContext],
  handler: runDeploy,
})
```

Middleware does not run when a schema fails, since validation comes first. See
[middleware](/docs/middleware) for the execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/codepipeline`.

| Type | Description |
| --- | --- |
| `CodePipelineRequest<TUserParameters>` | The handler argument |
| `CodePipelineResponse` | Handler return type, `CodePipelineSuccessResult \| undefined` |
| `CodePipelineSuccessResult` | The success shape, `{ outputVariables?, continuationToken? }` |
| `CodePipelineHandler<TUserParameters>` | The handler function type |
| `CodePipelineFilters` | The `filters` object |
| `CodePipelineFilterInput<TUserParameters>` | What `custom` receives |
| `CodePipelineRouteDefinition<TUserParameters>` | A full route passed to `route()` |
| `CodePipelineMiddleware` | Router and route middleware |
| `CodePipelineRouterOptions` | Options for `createCodePipelineRouter` |

The `CodePipelineRouter` class and the `createCodePipelineRouter` and `defineRoute` functions come
from the same place.

### Generic parameters

The types above that take a parameter all take the same one.

| Parameter | Types | Default |
| --- | --- | --- |
| `TUserParameters` | `request.userParameters` | `unknown` |

Leave it off and `userParameters` stays `unknown`, which is what you narrow in a handler with no
schema. You only need it for [annotated handlers](#annotated-handlers); an inferred handler reads it
from `userParametersSchema`.

## Code example

One Lambda backing two custom actions, a deploy that hands output variables to later stages and a
long-running migration that resumes itself through a continuation token.

Open a file: [index.ts](#codepipeline-example:index.ts) | [CodePipeline router](#codepipeline-example:codepipeline.ts) | [handlers](#codepipeline-example:handlers/actions.ts) | [schema](#codepipeline-example:schemas/deploy.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { codePipelineRouter } from './codepipeline.js'

const lambdaRouter = new LambdaRouter({
  routers: [codePipelineRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'codepipeline.ts',
    code: `import { createCodePipelineRouter } from '@lambda-event-router/codepipeline'

import { resumeMigration, runDeploy, startMigration } from './handlers/actions.js'
import { DeployParametersSchema } from './schemas/deploy.js'

export const codePipelineRouter = createCodePipelineRouter()

codePipelineRouter
  .continuation({
    filters: { functionName: 'migrate' },
    handler: resumeMigration,
  })
  .route({
    filters: { functionName: 'migrate', hasContinuationToken: false },
    handler: startMigration,
  })
  .route({
    filters: { functionName: 'deploy' },
    userParametersSchema: DeployParametersSchema,
    handler: runDeploy,
  })`,
  },
  {
    path: 'handlers/actions.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { CodePipelineRequest, CodePipelineResponse } from '@lambda-event-router/codepipeline'

import type { DeployParameters } from '../schemas/deploy.js'

export async function runDeploy(
  request: CodePipelineRequest<DeployParameters>,
): Promise<CodePipelineResponse> {
  const { environment, region } = request.userParameters
  logger.info(\`Deploying job \${request.jobId} to \${environment} in \${region}\`)
  return { outputVariables: { deployedRegion: region } }
}

export async function startMigration(request: CodePipelineRequest): Promise<CodePipelineResponse> {
  logger.info(\`Starting migration job \${request.jobId}\`)
  return { continuationToken: '1' }
}

export async function resumeMigration(request: CodePipelineRequest): Promise<CodePipelineResponse> {
  const step = Number(request.continuationToken)
  logger.info(\`Resuming migration job \${request.jobId} at step \${step}\`)
  if (step < 3) return { continuationToken: String(step + 1) }
}`,
  },
  {
    path: 'schemas/deploy.ts',
    code: `import { z } from 'zod'

export const DeployParametersSchema = z.object({
  environment: z.enum(['staging', 'production']),
  region: z.string(),
})

export type DeployParameters = z.infer<typeof DeployParametersSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="codepipeline-example" default-file="codepipeline.ts" line-numbers collapse-toggle fixed-height />

The `migrate` action has two routes. The continuation route matches only once CodePipeline re-invokes
the job with a token, so the first invocation falls to `startMigration` and every resume falls to
`resumeMigration`, whichever order they are registered in. The `deploy` action matches on a different
function name, so it never collides with either.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

# @lambda-event-router/codepipeline

Routes CodePipeline custom action jobs to handlers. The router reports success or failure back to the pipeline for you.

**Supported AWS Services:** `AWS CodePipeline`

**Available Routers:** `CodePipelineRouter`

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/codepipeline
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { codepipelineRouter } from './codepipeline'

const lambdaRouter = new LambdaRouter({
  routers: [codepipelineRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// codepipeline.ts
import { createCodePipelineRouter, defineRoute } from '@lambda-event-router/codepipeline'

const codepipelineRouter = createCodePipelineRouter()

// An inferred handler takes its types from the route
const processJob = defineRoute({
  filters: {
    functionName: 'deploy',
  },
}).handle(async ({ jobId }) => {
  console.log(`Processing job ${jobId}`)
})
codepipelineRouter.route(processJob)
```

Or use an annotated handler, which names its types rather than inferring them:

```ts
// codepipeline.ts
import { createCodePipelineRouter } from '@lambda-event-router/codepipeline'
import type { CodePipelineRequest } from '@lambda-event-router/codepipeline'

const codepipelineRouter = createCodePipelineRouter()

codepipelineRouter.route({
  filters: {
    functionName: 'deploy',
  },
  handler: processJob,
})

// An annotated handler names its own types
export async function processJob({ jobId }: CodePipelineRequest) {
  console.log(`Processing job ${jobId}`)
}
```


## Usage

#### Inferred handlers

```ts
import { createCodePipelineRouter, defineRoute } from '@lambda-event-router/codepipeline'

const codepipelineRouter = createCodePipelineRouter()

const processJob = defineRoute({
  filters: {
    functionName: 'deploy',
  },
}).handle(async ({ jobId }) => {
  console.log(`Processing job ${jobId}`)
})

codepipelineRouter.route(processJob)
```

#### Annotated handlers

```ts
import { createCodePipelineRouter } from '@lambda-event-router/codepipeline'
import type { CodePipelineRequest } from '@lambda-event-router/codepipeline'

const codepipelineRouter = createCodePipelineRouter()

codepipelineRouter.route({
  filters: {
    functionName: 'deploy',
  },
  handler: processJob,
})

async function processJob({ jobId }: CodePipelineRequest) {
  console.log(`Processing job ${jobId}`)
}
```

#### Helper methods

```ts
codepipelineRouter.continuation()
```

#### Filters

```ts
defineRoute({
  filters: {
    functionName: 'validate',
    hasInputArtifacts: true,
    hasContinuationToken: false,
    custom: ({ userParameters }) => userParameters !== undefined,
  },
})
```

#### Middleware

Register middleware on the router to cover every route, or on a single route. Type route middleware to
the route's schema, so `CodePipelineMiddleware<DeployParameters>` rather than `CodePipelineMiddleware`.

```ts
import type { CodePipelineMiddleware } from '@lambda-event-router/codepipeline'

const withDeployContext: CodePipelineMiddleware<DeployParameters> = async (request, next) => {
  console.log(`Deploying to ${request.userParameters.environment}`)
  return next(request)
}
```

## Examples

See the [service-examples/codepipeline](../../service-examples/codepipeline) directory for complete working examples.

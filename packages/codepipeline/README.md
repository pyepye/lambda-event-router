# @lambda-event-router/codepipeline

Routes CodePipeline custom action jobs to handlers. The router reports success or failure back to the pipeline for you.

**Supported AWS Services:** `AWS CodePipeline`

**Available Routers:** `CodePipelineRouter`

**Docs:** [CodePipelineRouter](https://pyepye.github.io/lambda-event-router/routers/CodePipelineRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/codepipeline
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { codePipelineRouter } from './codepipeline'

const lambdaRouter = new LambdaRouter({
  routers: [codePipelineRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// codepipeline.ts
import { createCodePipelineRouter, defineRoute } from '@lambda-event-router/codepipeline'

export const codePipelineRouter = createCodePipelineRouter()

const runDeploy = defineRoute({
  filters: {
    functionName: 'deploy',
    hasInputArtifacts: true,
    hasContinuationToken: false,
  },
}).handle(async ({ jobId }) => {
  console.log(`Deploying for job ${jobId}`)
  return { outputVariables: { deployedRegion: 'eu-west-2' } }
})

codePipelineRouter.route(runDeploy)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/CodePipelineRouter#annotated-handlers).

## Documentation

- [CodePipelineRouter](https://pyepye.github.io/lambda-event-router/routers/CodePipelineRouter) covers every filter, schema validation, responses
  and middleware.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/codepipeline](../../service-examples/codepipeline) for a deployable app.

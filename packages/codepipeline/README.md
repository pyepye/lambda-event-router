# @latcher/codepipeline

Routes CodePipeline custom action jobs to handlers. The matcher reports success or failure back to the pipeline for you.

**Supported AWS Services:** `AWS CodePipeline`

**Available Matchers:** `CodePipelineMatcher`

**Docs:** [CodePipelineMatcher](https://pyepye.github.io/latcher/matchers/CodePipelineMatcher)

## Install

```bash
npm install @latcher/base @latcher/codepipeline
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { codePipelineMatcher } from './codepipeline'

const latcher = new Latcher({
  matchers: [codePipelineMatcher],
})

export const handler = latcher.handler()
```

```ts
// codepipeline.ts
import { createCodePipelineMatcher, defineRoute } from '@latcher/codepipeline'

export const codePipelineMatcher = createCodePipelineMatcher()

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

codePipelineMatcher.route(runDeploy)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/CodePipelineMatcher#annotated-handlers).

## Documentation

- [CodePipelineMatcher](https://pyepye.github.io/latcher/matchers/CodePipelineMatcher) covers every filter, schema validation, responses
  and middleware.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/codepipeline](../../service-examples/codepipeline) for a deployable app.

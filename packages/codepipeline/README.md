# @lambda-event-router/codepipeline

CodePipeline job handler for custom pipeline actions.

**Supported AWS Services:** `AWS CodePipeline`

**Available Routers:** `CodePipelineRouter`

## Install

```bash
npm install @lambda-event-router/codepipeline
```


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

// Inline functions allows Typescript to automatic infer types
const processJob = defineRoute({
  filters: {
    customFilter: ({ job }) => job.data.actionConfiguration.configuration.FunctionName === 'deploy',
  },
}).handle(async ({ job }) => {
  console.log(`Processing job ${job.id}`)
})
codepipelineRouter.route(processJob)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// codepipeline.ts
import { createCodePipelineRouter } from '@lambda-event-router/codepipeline'

const codepipelineRouter = createCodePipelineRouter()

// Separate handler to define routes and handlers in different places
codepipelineRouter.route({
  filters: {
    customFilter: ({ job }) => job.data.actionConfiguration.configuration.FunctionName === 'deploy',
  },
  handler: processJob,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processJob({ job }) {
  console.log(`Processing job ${job.id}`)
}
```


## Usage

#### Inline handlers

```ts
import { createCodePipelineRouter, defineRoute } from '@lambda-event-router/codepipeline'

const codepipelineRouter = createCodePipelineRouter()

const processJob = defineRoute({
  filters: {
    customFilter: ({ job }) => job.data.actionConfiguration.configuration.FunctionName === 'deploy',
  },
}).handle(async ({ job }) => {
  console.log(`Processing job ${job.id}`)
})

codepipelineRouter.route(processJob)
```

#### Separate handlers

```ts
import { createCodePipelineRouter } from '@lambda-event-router/codepipeline'

const codepipelineRouter = createCodePipelineRouter()

codepipelineRouter.route({
  filters: {
    customFilter: ({ job }) => job.data.actionConfiguration.configuration.FunctionName === 'deploy',
  },
  handler: processJob,
})

async function processJob({ job }) {
  console.log(`Processing job ${job.id}`)
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
    customFilter: ({ job }) => job.data.actionConfiguration.configuration.FunctionName === 'validate',
  },
})
```

## Examples

See the [examples/codepipeline](../../examples/codepipeline) directory for complete working examples.

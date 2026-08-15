# @lambda-event-router/stepfunctions

Routes Step Functions task states to handlers. Task input has no fixed shape, so you match each task with a `custom` filter over the payload.

**Supported AWS Services:** `AWS Step Functions`

**Available Routers:** `StepFunctionsRouter`

**Docs:** [StepFunctionsRouter](https://pyepye.github.io/lambda-event-router/routers/StepFunctionsRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/stepfunctions
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { stepFunctionsRouter } from './stepfunctions'

const lambdaRouter = new LambdaRouter({
  routers: [stepFunctionsRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// stepfunctions.ts
import { isObject } from '@lambda-event-router/base'
import { createStepFunctionsRouter, defineRoute } from '@lambda-event-router/stepfunctions'

export const stepFunctionsRouter = createStepFunctionsRouter()

const requestApproval = defineRoute({
  filters: {
    taskToken: true,
    custom: ({ event }) => isObject(event) && event.taskType === 'humanApproval',
  },
}).handle(async ({ taskToken }) => {
  console.log(`Saving task token ${taskToken} until someone approves`)
})

stepFunctionsRouter.route(requestApproval)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/StepFunctionsRouter#annotated-handlers).

## Documentation

- [StepFunctionsRouter](https://pyepye.github.io/lambda-event-router/routers/StepFunctionsRouter) covers every filter, schema validation, responses
  and task tokens.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/stepfunctions](../../service-examples/stepfunctions) for a deployable app.

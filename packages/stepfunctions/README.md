# @latcher/stepfunctions

Routes Step Functions task states to handlers. Task input has no fixed shape, so you match each task with a `custom` filter over the payload.

**Supported AWS Services:** `AWS Step Functions`

**Available Matchers:** `StepFunctionsMatcher`

**Docs:** [StepFunctionsMatcher](https://pyepye.github.io/latcher/matchers/StepFunctionsMatcher)

## Install

```bash
npm install @latcher/base @latcher/stepfunctions
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { stepFunctionsMatcher } from './stepfunctions'

const latcher = new Latcher({
  matchers: [stepFunctionsMatcher],
})

export const handler = latcher.handler()
```

```ts
// stepfunctions.ts
import { isObject } from '@latcher/base'
import { createStepFunctionsMatcher, defineRoute } from '@latcher/stepfunctions'

export const stepFunctionsMatcher = createStepFunctionsMatcher()

const requestApproval = defineRoute({
  filters: {
    taskToken: true,
    custom: ({ event }) => isObject(event) && event.taskType === 'humanApproval',
  },
}).handle(async ({ taskToken }) => {
  console.log(`Saving task token ${taskToken} until someone approves`)
})

stepFunctionsMatcher.route(requestApproval)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/StepFunctionsMatcher#annotated-handlers).

## Documentation

- [StepFunctionsMatcher](https://pyepye.github.io/latcher/matchers/StepFunctionsMatcher) covers every filter, schema validation, responses
  and task tokens.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/stepfunctions](../../service-examples/stepfunctions) for a deployable app.

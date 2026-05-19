# @lambda-event-router/stepfunctions

Step Functions task routing for Lambda task states.

**Supported AWS Services:** `AWS Step Functions`

**Available Routers:** `StepFunctionsRouter`

## Install

```bash
npm install @lambda-event-router/stepfunctions
```


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { stepFunctionsRouter } from './stepfunctions'

const lambdaRouter = new LambdaRouter({
  routers: [stepFunctionsRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// stepfunctions.ts
import { isObject } from '@lambda-event-router/base'
import { createStepFunctionsRouter, defineRoute } from '@lambda-event-router/stepfunctions'
import { z } from 'zod'

const stepFunctionsRouter = createStepFunctionsRouter()

// Inline functions allows Typescript to automatic infer types
const processOrder = defineRoute({
  filters: {
    custom: ({ event }) => isObject(event) && event.taskType === 'process-order',
  },
  eventSchema: z.object({ taskType: z.literal('process-order'), orderId: z.string() }),
}).handle(async ({ event }) => {
  console.log(`Processing order ${event.orderId}`)
})
stepFunctionsRouter.route(processOrder)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// stepfunctions.ts
import { isObject } from '@lambda-event-router/base'
import { createStepFunctionsRouter } from '@lambda-event-router/stepfunctions'

const stepFunctionsRouter = createStepFunctionsRouter()

// Separate handler to define routes and handlers in different places
stepFunctionsRouter.route({
  filters: {
    custom: ({ event }) => isObject(event) && event.taskType === 'process-order',
  },
  eventSchema: EventSchema,
  handler: processOrder,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processOrder({ event }) {
  console.log(`Processing order ${event.orderId}`)
}
```


## Usage

#### Inline handlers

```ts
import { isObject } from '@lambda-event-router/base'
import { createStepFunctionsRouter, defineRoute } from '@lambda-event-router/stepfunctions'

const stepFunctionsRouter = createStepFunctionsRouter()

const processOrder = defineRoute({
  filters: {
    custom: ({ event }) => isObject(event) && event.taskType === 'process-order',
  },
  eventSchema: EventSchema,
}).handle(async ({ event }) => {
  console.log(`Processing order ${event.orderId}`)
})

stepFunctionsRouter.route(processOrder)
```

#### Separate handlers

```ts
import { isObject } from '@lambda-event-router/base'
import { createStepFunctionsRouter } from '@lambda-event-router/stepfunctions'

const stepFunctionsRouter = createStepFunctionsRouter()

stepFunctionsRouter.route({
  filters: {
    custom: ({ event }) => isObject(event) && event.taskType === 'process-order',
  },
  eventSchema: EventSchema,
  handler: processOrder,
})

async function processOrder({ event }) {
  console.log(`Processing order ${event.orderId}`)
}
```

#### Filters

```ts
defineRoute({
  filters: {
    custom: ({ event }) => isObject(event) && event.taskType === 'validate-input',
  },
})
```

#### Middleware

Handlers receive `{ event, context }`, where `context` is the Lambda `Context`. TaskToken handlers
receive `{ taskToken, input, event, context }`. Middleware runs over that request. Register it on the
router to cover every route, or on a single route. Router middleware runs before route middleware.

```ts
import type { StepFunctionsMiddleware } from '@lambda-event-router/stepfunctions'

const withLogging: StepFunctionsMiddleware = async (request, next) => {
  console.log(`Handling task ${request.context.awsRequestId}`)
  return next(request)
}

// Router-level: runs for every route
const stepFunctionsRouter = createStepFunctionsRouter({ middleware: [withLogging] })

// Route-level: runs for this route only
const processOrder = defineRoute({
  filters: { custom: ({ event }) => isObject(event) && event.taskType === 'process-order' },
  eventSchema: EventSchema,
  middleware: [withLogging],
}).handle(async ({ event, context }) => {
  console.log(`Processing order ${event.orderId} (${context.awsRequestId})`)
})
```

## Examples

See the [examples/stepfunctions](../../examples/stepfunctions) directory for complete working examples.

# StepFunctionsRouter

`StepFunctionsRouter` routes AWS Step Functions task events to handlers, one task per invocation.

A task state in a state machine invokes your Lambda with whatever JSON you put in its input, so there is
no fixed AWS envelope to match on the way the other routers match a service event. You identify each of
your tasks with a `custom` over the payload, and the router hands the matched handler that payload
to act on.

This router claims almost any event, so `LambdaRouter` sorts it after the dedicated routers for you.
Its check turns down the events it recognises as another service (SQS, SNS, S3, DynamoDB, Kinesis, API
Gateway, Cognito and EventBridge) and accepts everything else, since a task payload can look like
anything. It sorts ahead of `EventRouter`, and a shape it claims but has no route for falls through to
`EventRouter` as the final fallback. See [Register routes](#register-routes) for how to keep it to your
own tasks.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/stepfunctions
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createStepFunctionsRouter } from '@lambda-event-router/stepfunctions'
import { logTask } from './middleware/logTask'

const stepFunctionsRouter = createStepFunctionsRouter({
  middleware: [logTask],  // Optional
})
```

`createStepFunctionsRouter()` on its own gives you a router with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `StepFunctionsMiddleware[]` | No | `[]` | Runs for every task this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
import { isObject } from '@lambda-event-router/base'

stepFunctionsRouter.route({
  filters: {
    custom: ({ event }) => isObject(event) && event.taskType === 'processOrder',
  },
  eventSchema: OrderSchema,  // Optional
  middleware: [withOrderContext],  // Optional
  handler: processOrder,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
stepFunctionsRouter.route(processOrderRoute).route(enrichDataRoute)
```

Routes match in registration order and the first match wins. A task payload carries no service
identifier, so give every route a `custom` that recognises its own task, usually a `taskType`
field you set in the state machine. See [match order](/docs/routing#match-order) for what goes wrong
when they overlap.

**A route with empty `filters` matches every event this router claims, which is nearly all of them.**
That makes the whole Lambda a Step Functions Lambda, so keep an unfiltered route for a Lambda that only
handles tasks. `LambdaRouter` sorts this router after the dedicated ones, so a loose route cannot take
their events, but it still beats `EventRouter` to any payload neither recognises. See
[routers](/docs/routers) for how `LambdaRouter` picks between routers.

**A task that matches no route throws** `No route matched for Step Functions event`. That miss lets the
event fall through to the next router rather than failing the invocation, so a task the router claimed
but has no route for is handed on. When `StepFunctionsRouter` is the only router that could take the
event, the miss fails the invocation and the task state gets the error. See [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

## Filters

Both filter keys on one route. They are optional, but a route with neither claims every task, so in
practice every route sets a `custom`.

```ts
import { isObject } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/stepfunctions'

const approvalRoute = defineRoute({
  filters: {
    taskToken: true,
    custom: ({ event }) => isObject(event) && event.taskType === 'humanApproval',
  },
  eventSchema: ApprovalSchema,
}).handle(async ({ taskToken, input }) => {
  // A taskToken route hands the handler the callback token, see Task tokens
})

stepFunctionsRouter.route(approvalRoute)
```

| Filter | Type | Description |
| --- | --- | --- |
| `taskToken` | `boolean` | Set to `true` to match only events carrying a string `TaskToken`, and switch the handler to the [callback request shape](#task-tokens) |
| `custom` | `(input: StepFunctionsFilterInput) => boolean \| Promise<boolean>` | Given the raw event as `unknown`. This is how a route recognises its own task. Can be async |

This route is built with `defineRoute` rather than passed straight to `route()`. An inline `taskToken`
handler needs `defineRoute` to pick up the callback request type; through `route()` the same inline
handler infers `any`. A handler written in its own file and annotated fits either.

**`custom` is the only way a route recognises its task**, and its `event` is `unknown`, so narrow
it with `isObject` from `@lambda-event-router/base` before reading a field off it. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

A regular handler takes the payload and returns the task output.

```ts
import { logger } from '@lambda-event-router/base'
import type { StepFunctionsRequest } from '@lambda-event-router/stepfunctions'

export async function processOrder({ event }: StepFunctionsRequest<Order>): Promise<OrderResult> {
  logger.info(`Processing order ${event.orderId}`)
  return { orderId: event.orderId, status: 'processed' }
}
```

### Request object

A regular route hands the handler two fields.

| Field | Type | Description |
| --- | --- | --- |
| `event` | `TInput` | The task payload. `unknown` until you type it with an `eventSchema` or an annotation |
| `context` | `Context` | The Lambda context |

A route with `taskToken: true` hands a different shape, adding the callback token and the parsed input.
See [Task tokens](#task-tokens) for that request and when to reach for it. `Context` comes from
`aws-lambda`; there is no `aws-lambda` event type, since a task payload is arbitrary JSON.

### Response type

Handlers return `Promise<unknown>`, and the router hands that value straight back. For a normal task it
becomes the task output. See [Responses](#responses) for what Step Functions does with it and how a
callback task differs.

### Inferred handlers

`defineRoute` reads the `eventSchema` and hands your handler a typed `event` without you naming it.
Below, `event.orderId` is a `string` because `OrderSchema` says so.

```ts
import { isObject, logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/stepfunctions'
import { z } from 'zod'

const OrderSchema = z.object({ taskType: z.literal('processOrder'), orderId: z.string() })

export const processOrderRoute = defineRoute({
  filters: { custom: ({ event }) => isObject(event) && event.taskType === 'processOrder' },
  eventSchema: OrderSchema,
}).handle(async ({ event }) => {
  logger.info(`Processing order ${event.orderId}`)
  return { orderId: event.orderId, status: 'processed' }
})

stepFunctionsRouter.route(processOrderRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same source
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`StepFunctionsRequest`](#generic-parameters) and your own type for the payload.

```ts
// handlers/processOrder.ts
import { logger } from '@lambda-event-router/base'
import type { StepFunctionsRequest } from '@lambda-event-router/stepfunctions'
import { z } from 'zod'

export const OrderSchema = z.object({ taskType: z.literal('processOrder'), orderId: z.string() })
type Order = z.infer<typeof OrderSchema>

export async function processOrder({ event }: StepFunctionsRequest<Order>): Promise<{ status: string }> {
  logger.info(`Processing order ${event.orderId}`)
  return { status: 'processed' }
}
```

```ts
// stepFunctions.ts
import { isObject } from '@lambda-event-router/base'
import { createStepFunctionsRouter } from '@lambda-event-router/stepfunctions'
import { OrderSchema, processOrder } from './handlers/processOrder'

const stepFunctionsRouter = createStepFunctionsRouter()

stepFunctionsRouter.route({
  filters: { custom: ({ event }) => isObject(event) && event.taskType === 'processOrder' },
  eventSchema: OrderSchema,
  handler: processOrder,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
Type a callback route's handler with [`StepFunctionsTaskTokenRequest`](#task-tokens) instead, since it
carries the token and the parsed input. See [annotated handlers](/docs/handlers#annotated-handlers) for
the worked version.

## Schema validation

`eventSchema` is the only schema key and it is optional. What it validates depends on the route.

```ts
const OrderSchema = z.object({
  taskType: z.literal('processOrder'),
  orderId: z.string(),
})

stepFunctionsRouter.route({
  filters: { custom: ({ event }) => isObject(event) && event.taskType === 'processOrder' },
  eventSchema: OrderSchema,
  handler: processOrder,
})
```

| Key | Validates |
| --- | --- |
| `eventSchema` | The whole payload on a regular route, or the payload with `TaskToken` removed on a `taskToken` route |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so a payload failing its schema throws rather than falling through to the next route. On a
regular route the output types `request.event`; on a `taskToken` route it types `request.input`, since
the token has already been split off. See [schema validation](/docs/routing#schema-validation) for what
your handler receives after coercion.

## Responses

Your handler returns a value and the router hands it straight back, so what happens to it is Step
Functions' contract rather than the router's.

For a task invoked in the request and response style, the returned value becomes the task's output, and
Step Functions merges it into the execution state per the task's `ResultPath`. Return the data the next
state needs.

```ts
return { orderId: event.orderId, status: 'processed' }
```

**A `.waitForTaskToken` task ignores the return value.** Step Functions pauses the execution when it
starts the task and waits for you to call `SendTaskSuccess` or `SendTaskFailure` with the task token,
which can be minutes or days later. The handler's job is to store the token and start whatever the state
machine is waiting on, then return. See [Task tokens](#task-tokens) for the request shape that carries
the token.

Throwing from a handler fails the invocation, which for a request and response task fails the task state
so its `Catch` and `Retry` apply. Since the router returns whatever the handler returns, throwing is the
only failure signal for a synchronous task.

## Task tokens

The `.waitForTaskToken` service integration lets a task pause the execution until something outside it
reports back, a human approval or a long-running job. Step Functions puts a `TaskToken` in the payload
and holds the task open until that token is used.

Set `taskToken: true` on a route to handle those tasks. The router matches only events carrying a string
`TaskToken`, splits the token off the payload, validates the rest against `eventSchema` and hands the
handler a different request.

```ts
import { logger } from '@lambda-event-router/base'
import type { StepFunctionsTaskTokenRequest } from '@lambda-event-router/stepfunctions'

export async function requestApproval(
  { taskToken, input }: StepFunctionsTaskTokenRequest<ApprovalRequest>,
): Promise<void> {
  logger.info(`Approval ${input.requestId} needs sign-off`)
  await saveTokenForLater(input.requestId, taskToken)
  // Later, out of band: sfn.sendTaskSuccess({ taskToken, output }) or sfn.sendTaskFailure({ taskToken })
}
```

| Field | Type | Description |
| --- | --- | --- |
| `taskToken` | `string` | The callback token to pass to `SendTaskSuccess` or `SendTaskFailure` |
| `input` | `TInput` | The payload with `TaskToken` removed, validated against `eventSchema` |
| `event` | `unknown` | The untouched payload, `TaskToken` included |
| `context` | `Context` | The Lambda context |

A `defineRoute` with `taskToken: true` infers this shape for an inline handler, and
`StepFunctionsTaskTokenRequest<TInput>` types an annotated one. Returning from the handler does not
resolve the task; only the callback does.

## Middleware

Router and route middleware are both typed `StepFunctionsMiddleware`, and the chain runs once per task.

```ts
import { logger } from '@lambda-event-router/base'
import type { StepFunctionsMiddleware } from '@lambda-event-router/stepfunctions'

export const logTask: StepFunctionsMiddleware = async (request, next) => {
  logger.info(`Handling task ${request.context.awsRequestId}`)
  return next(request)
}
```

```ts
const stepFunctionsRouter = createStepFunctionsRouter({ middleware: [logTask] })

stepFunctionsRouter.route({
  filters: { custom: ({ event }) => isObject(event) && event.taskType === 'processOrder' },
  middleware: [withOrderContext],
  handler: processOrder,
})
```

**A callback route takes a different middleware type.** The validated payload sits on `event` for a
regular route and on `input` for a `taskToken` route, so each has its own alias.

```ts
const withOrderContext: StepFunctionsMiddleware<unknown, Order> = async (request, next) => {
  logger.appendKeys({ orderId: request.event.orderId })
  return next(request)
}

const withApprovalContext: StepFunctionsTaskTokenMiddleware<unknown, Approval> = async (request, next) => {
  logger.appendKeys({ approvalId: request.input.approvalId })
  return next(request)
}
```

Type route middleware to the route's `eventSchema`. Router middleware takes no type argument, because
it runs for every route. It also runs before route middleware. See
[middleware](/docs/middleware) for the execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/stepfunctions`.

| Type | Description |
| --- | --- |
| `StepFunctionsRequest<TInput>` | The handler argument for a regular route |
| `StepFunctionsTaskTokenRequest<TInput>` | The handler argument for a `taskToken` route |
| `StepFunctionsHandler<TInput>` | The regular handler, returning `Promise<unknown>` |
| `StepFunctionsTaskTokenHandler<TInput>` | The callback handler, returning `Promise<unknown>` |
| `StepFunctionsFilters` | The `filters` object |
| `StepFunctionsFilterInput` | What `custom` receives, `{ event: unknown }` |
| `StepFunctionsMiddleware<TResponse, TInput>` | Router and route middleware on a regular route |
| `StepFunctionsTaskTokenMiddleware<TResponse, TInput>` | Route middleware on a `taskToken` route |
| `StepFunctionsRouteDefinition<TInput>` | A full route passed to `route()` |
| `StepFunctionsTaskTokenRouteDefinition<TInput>` | A `taskToken` route passed to `route()` |
| `StepFunctionsRouterOptions` | Options for `createStepFunctionsRouter` |

The `StepFunctionsRouter` class and the `createStepFunctionsRouter` and `defineRoute` functions come
from the same place. There is no `StepFunctionsResponse` type, since a handler returns `Promise<unknown>`
directly.

### Generic parameters

The types above that take a parameter all take the same one.

| Parameter | Types | Default |
| --- | --- | --- |
| `TInput` | `request.event` on a regular route, `request.input` on a `taskToken` route | `unknown` |
| `TResponse` | What a middleware returns | `unknown` |

The two middleware aliases take `TResponse` first, so a typed middleware reads
`StepFunctionsMiddleware<unknown, Order>`.

Leave it off and the payload is `unknown`, which is what you get without an `eventSchema`. An
`eventSchema` sets it for you through `defineRoute`; pass it yourself only for [annotated
handlers](#annotated-handlers).

## Code example

One Lambda behind a state machine: a request and response task that processes an order and returns its
result, and a `.waitForTaskToken` task that parks a human approval until someone signs off.

Open a file: [index.ts](#stepfunctions-example:index.ts) | [Step Functions router](#stepfunctions-example:stepFunctions.ts) | [handlers](#stepfunctions-example:handlers/tasks.ts) | [schemas](#stepfunctions-example:schemas/tasks.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { stepFunctionsRouter } from './stepFunctions.js'

const lambdaRouter = new LambdaRouter({
  routers: [stepFunctionsRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'stepFunctions.ts',
    code: `import { isObject } from '@lambda-event-router/base'
import { createStepFunctionsRouter } from '@lambda-event-router/stepfunctions'

import { processOrder, requestApproval } from './handlers/tasks.js'
import { ApprovalSchema, OrderSchema } from './schemas/tasks.js'

export const stepFunctionsRouter = createStepFunctionsRouter()

stepFunctionsRouter
  .route({
    filters: { custom: ({ event }) => isObject(event) && event.taskType === 'processOrder' },
    eventSchema: OrderSchema,
    handler: processOrder,
  })
  .route({
    filters: {
      taskToken: true,
      custom: ({ event }) => isObject(event) && event.taskType === 'humanApproval',
    },
    eventSchema: ApprovalSchema,
    handler: requestApproval,
  })`,
  },
  {
    path: 'handlers/tasks.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { StepFunctionsRequest, StepFunctionsTaskTokenRequest } from '@lambda-event-router/stepfunctions'

import type { Approval, Order } from '../schemas/tasks.js'

export async function processOrder({ event }: StepFunctionsRequest<Order>): Promise<{ orderId: string; status: string }> {
  logger.info(\`Processing order \${event.orderId}\`)
  return { orderId: event.orderId, status: 'processed' }
}

export async function requestApproval(
  { taskToken, input }: StepFunctionsTaskTokenRequest<Approval>,
): Promise<void> {
  logger.info(\`Approval \${input.requestId} from \${input.requester} needs sign-off\`)
  // Store taskToken, then later: sfn.sendTaskSuccess({ taskToken, output }) once signed off
}`,
  },
  {
    path: 'schemas/tasks.ts',
    code: `import { z } from 'zod'

export const OrderSchema = z.object({
  taskType: z.literal('processOrder'),
  orderId: z.string(),
})

export const ApprovalSchema = z.object({
  taskType: z.literal('humanApproval'),
  requestId: z.string(),
  requester: z.string(),
})

export type Order = z.infer<typeof OrderSchema>
export type Approval = z.infer<typeof ApprovalSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="stepfunctions-example" default-file="stepFunctions.ts" line-numbers collapse-toggle fixed-height />

Each route matches a different `taskType`, so no task reaches two and the order they register in makes
no difference between them. This Lambda only handles Step Functions tasks, so there is no other router
for a task to fall through to.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit together.

# @lambda-event-router/base

Main dispatcher that routes AWS Lambda events to service-specific routers. This is the core package that ties all service routers together.

**Supported AWS Services:** `AWS Lambda` (every event source via `LambdaRouter`, direct invocation and custom envelopes via `EventRouter`)

**Available Routers:** `LambdaRouter` | `EventRouter`

(See [Routers](#routers) for more details)

## Install

```bash
npm install @lambda-event-router/base
```


## Quick Start

This example is for the EventRouter. See [Usage](#usage) for examples of the other routers

```ts
// main handler
import { createEventRouter, defineEventRoute, LambdaRouter, logger } from '@lambda-event-router/base'
import { z } from 'zod'

const eventRouter = createEventRouter()

// Inline functions allows Typescript to automatic infer types
const processOrder = defineEventRoute({
  filters: {
    custom: ({ event }) => event.action === 'process-order',
  },
  eventSchema: z.object({
    action: z.literal('process-order'),
    orderId: z.string(),
  }),
}).handle(async ({ event }) => {
  logger.info(`Processing order ${event.orderId}`)
  return { orderId: event.orderId, status: 'processed' }
})
eventRouter.route(processOrder)

const lambdaRouter = new LambdaRouter({ routers: [eventRouter] })
export const handler = lambdaRouter.handler()
```

OR use a the separate syntax to split router and handlers across files:

```ts
import { createEventRouter, logger } from '@lambda-event-router/base'
import type { EventRequest } from '@lambda-event-router/base'
import { z } from 'zod'

const eventRouter = createEventRouter()

const OrderSchema = z.object({
  action: z.literal('process-order'),
  orderId: z.string(),
})
type Order = z.infer<typeof OrderSchema>

// Separate handler to define routes and handlers in different places
eventRouter.route({
  filters: {
    custom: ({ event }) => event.action === 'process-order',
  },
  eventSchema: OrderSchema,
  handler: processOrder,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processOrder({ event }: EventRequest<Order>) {
  logger.info(`Processing order ${event.orderId}`)
  return { orderId: event.orderId, status: 'processed' }
}
```

`custom` is given the **raw** event even though `eventSchema` types it as the schema output, so a coerced or defaulted field arrives in the form the caller sent it. Where a route has no `eventSchema` the event is `unknown`, so narrow it with `isObject` before reading anything.

Where nothing reads the return value, such as an EventBridge Scheduler payload or an asynchronous `Invoke`, set the response type to `void`:

```ts
const eventRouter = createEventRouter<void>()

eventRouter.route({ filters: {}, handler: onSchedule })
```

`defineEventRoute` defaults its response to `unknown`, which a `void` router rejects, so register with `route()` as above or pass both parameters as `defineEventRoute<unknown, void>({ ... })`.


## Routers

| AWS Service | Event Source | Router | Usage
|---|---|---|---|
| AWS Lambda | Multiple event sources | `LambdaRouter` | [LambdaRouter](#lambdarouter) |
| AWS Lambda | Direct invocation / generic events | `EventRouter` | [EventRouter](#eventrouter) |


## Usage

### LambdaRouter

`LambdaRouter` is the Lambda entry point. Every other router gets registered on it and
`lambdaRouter.handler()` is what you export.

#### Combining multiple service routers

```ts
import { LambdaRouter } from '@lambda-event-router/base'
import { createSQSRouter } from '@lambda-event-router/sqs'
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge'

const sqsRouter = createSQSRouter()
const eventBridgeRouter = createEventBridgeRouter()

// Register routes on each router...

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter, eventBridgeRouter],
})

export const handler = lambdaRouter.handler()
```

`createLambdaRouter({ routers: [...] })` is the same call in the factory form the service routers use.

#### Options

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `routers` | `EventTypeRouter[]` | Yes | | Every router this Lambda can receive events for |
| `middleware` | `Array<(event, context, next) => Promise<unknown>>` | No | `[]` | Runs for every event, before a router is picked |

`EventRouter` is always sorted to the end of `routers`, so a dedicated router gets first refusal on its own events.

A router that claims an event and then finds none of its own routes match throws `NoRouteMatchedError`, exported from `@lambda-event-router/base`, and `LambdaRouter` tries the next router rather than failing. This is what lets `EventRouter` and `StepFunctionsRouter` share one Lambda. Any other error fails the invocation, a failing `eventSchema` included. An event no router handles throws `No router found for event`.

#### Global middleware

Middleware on `LambdaRouter` runs for every event, whichever router takes it. It gets the raw event and the Lambda context rather than a request object, because no router has been picked yet. There is no exported type for it, so declare `next` yourself.

```ts
import type { Context } from 'aws-lambda'
import { LambdaRouter, logger } from '@lambda-event-router/base'

type LambdaNext = (event: unknown, context: Context) => Promise<unknown>

const withTiming = async (event: unknown, context: Context, next: LambdaNext): Promise<unknown> => {
  const startedAt = Date.now()

  try {
    return await next(event, context)
  } finally {
    logger.info(`Invocation finished in ${Date.now() - startedAt}ms`)
  }
}

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter],
  middleware: [withTiming],
})
```

### EventRouter

The `EventRouter` handles events that don't have a dedicated service router, such as direct Lambda invocations, EventBridge Scheduler payloads, Step Functions tasks, or IoT Core rule actions.

It refuses any event it recognises as a known AWS source, so adding one cannot take events away from the rest of your Lambda. That includes the EventBridge envelope, so use `EventBridgeRouter` for bus, pipe and rule events and this router for Scheduler.

#### Inline handlers

```ts
import { createEventRouter, defineEventRoute, logger } from '@lambda-event-router/base'
import { z } from 'zod'

const eventRouter = createEventRouter()

const ReportSchema = z.object({
  command: z.literal('generate-report'),
  reportId: z.string(),
  format: z.enum(['pdf', 'csv']),
})

const generateReport = defineEventRoute({
  filters: {
    custom: ({ event }) => event.command === 'generate-report',
  },
  eventSchema: ReportSchema,
}).handle(async ({ event }) => {
  logger.info(`Generating ${event.format} report ${event.reportId}`)
  return { reportId: event.reportId, format: event.format }
})

eventRouter.route(generateReport)
```

#### Separate handlers

```ts
import { createEventRouter, logger } from '@lambda-event-router/base'
import type { EventRequest } from '@lambda-event-router/base'
import { z } from 'zod'

const eventRouter = createEventRouter()

const ReportSchema = z.object({
  command: z.literal('generate-report'),
  reportId: z.string(),
  format: z.enum(['pdf', 'csv']),
})
type Report = z.infer<typeof ReportSchema>

eventRouter.route({
  filters: {
    custom: ({ event }) => event.command === 'generate-report',
  },
  eventSchema: ReportSchema,
  handler: generateReport,
})

async function generateReport({ event }: EventRequest<Report>) {
  logger.info(`Generating ${event.format} report ${event.reportId}`)
  return { reportId: event.reportId, format: event.format }
}
```

Route middleware on a route carrying an `eventSchema` needs the payload type, so `EventRouterMiddleware<Report>` rather than the bare alias. The bare one defaults its payload to `unknown` and quietly loosens the rest of the route.

## Examples

See the [examples/base](../../examples/base) directory for complete working examples.

# @lambda-event-router/base

Main dispatcher that routes AWS Lambda events to service-specific routers. This is the core package that ties all service routers together.

**Supported AWS Services:** `AWS Lambda` (direct invocation)

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
import { createEventRouter, defineEventRoute, LambdaRouter } from '@lambda-event-router/base'
import { z } from 'zod'

const eventRouter = createEventRouter()

// Inline functions allows Typescript to automatic infer types
const processOrder = defineEventRoute({
  filters: {
    customFilter: ({ event }) => event.action === 'process-order',
  },
  eventSchema: z.object({
    action: z.literal('process-order'),
    orderId: z.string(),
  }),
}).handle(async ({ event }) => {
  console.log(`Processing order ${event.orderId}`)
  return { orderId: event.orderId, status: 'processed' }
})
eventRouter.route(processOrder)

const lambdaRouter = new LambdaRouter({ routers: [eventRouter] })
export const handler = lambdaRouter.handler()
```

OR use a the separate syntax to split router and handlers across files:

```ts
import { createEventRouter } from '@lambda-event-router/base'

const eventRouter = createEventRouter()

// Separate handler to define routes and handlers in different places
eventRouter.route({
  filters: {
    customFilter: ({ event }) => event.action === 'process-order',
  },
  eventSchema: EventSchema,
  handler: processOrder,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processOrder({ event }) {
  return { orderId: event.orderId, status: 'processed' }
}
```

For fire-and-forget event sources (EventBridge rules, SNS, S3 notifications, CloudWatch Logs, IoT) where no return value is needed, set the type to `void`:

```ts
const eventRouter = createEventRouter<void>()
```


## Routers

| AWS Service | Event Source | Router | Usage
|---|---|---|---|
| AWS Lambda | Multiple event sources | `LambdaRouter` | <Usage link here> |
| AWS Lambda | Direct invocation / generic events | `EventRouter` | <Usage link here> |


## Usage

### LambdaRouter

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

### EventRouter

The `EventRouter` handles events that don't have a dedicated service router, such as direct Lambda invocations, Step Functions tasks, or IoT Core rule actions.

#### Inline handlers

```ts
import { createEventRouter, defineEventRoute } from '@lambda-event-router/base'
import { z } from 'zod'

const eventRouter = createEventRouter()

const ReportSchema = z.object({
  command: z.literal('generate-report'),
  reportId: z.string(),
  format: z.enum(['pdf', 'csv']),
})

const generateReport = defineEventRoute({
  filters: {
    customFilter: ({ event }) => event.command === 'generate-report',
  },
  eventSchema: ReportSchema,
}).handle(async ({ event }) => {
  console.log(`Generating ${event.format} report ${event.reportId}`)
  return { reportId: event.reportId, format: event.format }
})

eventRouter.route(generateReport)
```

#### Separate handlers

```ts
import { createEventRouter } from '@lambda-event-router/base'

const eventRouter = createEventRouter()

eventRouter.route({
  filters: {
    customFilter: ({ event }) => event.command === 'generate-report',
  },
  eventSchema: ReportSchema,
  handler: generateReport,
})

async function generateReport({ event }) {
  console.log(`Generating ${event.format} report ${event.reportId}`)
  return { reportId: event.reportId, format: event.format }
}
```

## Examples

See the [examples/base](../../examples/base) directory for complete working examples.

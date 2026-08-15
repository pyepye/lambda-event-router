# @lambda-event-router/base

The core package. `LambdaRouter` is the handler you export, and it passes each event to the router that owns it. `EventRouter` handles events that have no AWS envelope, such as direct invocations.

**Supported AWS Services:** `AWS Lambda` (every event source via `LambdaRouter`, direct invocation and custom envelopes via `EventRouter`)

**Available Routers:** `LambdaRouter` | `EventRouter`

**Docs:** [LambdaRouter](https://pyepye.github.io/lambda-event-router/routers/LambdaRouter) | [EventRouter](https://pyepye.github.io/lambda-event-router/routers/EventRouter)

## Install

```bash
npm install @lambda-event-router/base
```

## Quick Start

Create a router for each AWS service your Lambda receives events from, then register them all on one `LambdaRouter`. Export its handler.

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { apiRouter } from './api'
import { sqsRouter } from './sqs'

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter, sqsRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// api.ts
import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'
import { getOrder } from './order/get'

export const apiRouter = createAPIGatewayRouter()

apiRouter.route({
  filters: { method: 'GET', path: '/order/:id' },
  handler: getOrder,
})
```

```ts
// sqs.ts
import { createSQSRouter } from '@lambda-event-router/sqs'
import { processOrder } from './order/process'
import { refundOrder } from './order/refund'

export const sqsRouter = createSQSRouter()

sqsRouter.route({
  filters: { messageAttributes: { Type: 'ProcessOrder' } },
  handler: processOrder,
})

sqsRouter.route({
  filters: { messageAttributes: { Type: 'RefundOrder' } },
  handler: refundOrder,
})
```

`LambdaRouter` works out which router owns each event, and that router picks the route.

Events with no AWS envelope, such as a direct `Invoke` or an EventBridge Scheduler payload, go to
`EventRouter`. It has no fields to filter on, so a `custom` filter identifies each route:

```ts
// events.ts
import { createEventRouter, defineEventRoute, isObject } from '@lambda-event-router/base'
import { z } from 'zod'

export const eventRouter = createEventRouter()

const generateReport = defineEventRoute({
  filters: {
    custom: ({ event }) => isObject(event) && event.command === 'generate-report',
  },
  eventSchema: z.object({ command: z.literal('generate-report'), reportId: z.string() }),
}).handle(async ({ event }) => {
  console.log(`Generating report ${event.reportId}`)
  return { reportId: event.reportId }
})

eventRouter.route(generateReport)
```

## Documentation

- [LambdaRouter](https://pyepye.github.io/lambda-event-router/routers/LambdaRouter) covers picking a router, options, middleware and custom routers.
- [EventRouter](https://pyepye.github.io/lambda-event-router/routers/EventRouter) covers which events reach it, filters, schema validation and
  failures.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

- [service-examples](../../service-examples) has one deployable app per AWS service. Each one registers its service routers on a `LambdaRouter`.
- [full-examples](../../full-examples) has apps that chain several AWS services, with one `LambdaRouter` combining several routers in each Lambda.

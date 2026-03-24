# @lambda-event-router/eventbridge

EventBridge event routing by source, detail type, account, region, and resources with schema validation.

**Supported AWS Services:** `Amazon EventBridge`

**Available Routers:** `EventBridgeRouter`

## Install

```bash
npm install @lambda-event-router/eventbridge
```


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { eventBridgeRouter } from './eventbridge'

const lambdaRouter = new LambdaRouter({
  routers: [eventBridgeRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// eventbridge.ts
import { createEventBridgeRouter, defineRoute } from '@lambda-event-router/eventbridge'
import { z } from 'zod'

const eventBridgeRouter = createEventBridgeRouter()

// Inline functions allows Typescript to automatic infer types
const processOrder = defineRoute({
  filters: {
    sources: ['myapp.orders'],
    detailTypes: ['Order Created'],
  },
  detailSchema: z.object({ orderId: z.string(), customerId: z.string() }),
}).handle(async ({ source, detailType, detail }) => {
  console.log(`Order ${detail.orderId} created for ${detail.customerId}`)
})
eventBridgeRouter.route(processOrder)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// eventbridge.ts
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge'

const eventBridgeRouter = createEventBridgeRouter()

// Separate handler to define routes and handlers in different places
eventBridgeRouter.route({
  filters: {
    sources: ['myapp.orders'],
    detailTypes: ['Order Created'],
  },
  detailSchema: OrderDetailSchema,
  handler: processOrder,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processOrder({ source, detailType, detail }) {
  console.log(`Order ${detail.orderId} created for ${detail.customerId}`)
}
```


## Usage

#### Inline handlers

```ts
import { createEventBridgeRouter, defineRoute } from '@lambda-event-router/eventbridge'

const eventBridgeRouter = createEventBridgeRouter()

const processOrder = defineRoute({
  filters: {
    sources: ['myapp.orders'],
    detailTypes: ['Order Created', 'Order Updated'],
  },
  detailSchema: OrderDetailSchema,
}).handle(async ({ detailType, detail }) => {
  console.log(`Order ${detail.orderId} - ${detailType}`)
})

eventBridgeRouter.route(processOrder)
```

#### Separate handlers

```ts
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge'

const eventBridgeRouter = createEventBridgeRouter()

eventBridgeRouter.route({
  filters: {
    sources: ['myapp.orders'],
    detailTypes: ['Order Created', 'Order Updated'],
  },
  detailSchema: OrderDetailSchema,
  handler: processOrder,
})

async function processOrder({ detailType, detail }) {
  console.log(`Order ${detail.orderId} - ${detailType}`)
}
```

#### Filters

```ts
defineRoute({
  filters: {
    sources: ['aws.ec2'],
    detailTypes: ['EC2 Instance State-change Notification'],
    accounts: ['123456789012'],
    regions: ['us-east-1'],
    resources: ['arn:aws:ec2:us-east-1:123456789:instance/i-1234'],
    customFilter: ({ detail }) => detail.state === 'running',
  },
})
```

#### AWS service events

```ts
// EC2 state changes - types are automatically inferred
defineRoute({
  filters: {
    sources: ['aws.ec2'],
    detailTypes: ['EC2 Instance State-change Notification'],
  },
}).handle(async ({ detail, account, region, time }) => {
  console.log(`Instance ${detail['instance-id']} changed to ${detail.state}`)
})

// Scheduled rules
defineRoute({
  filters: {
    sources: ['aws.events'],
    detailTypes: ['Scheduled Event'],
  },
}).handle(async ({ time, resources }) => {
  console.log(`Scheduled rule triggered at ${time}`)
})
```

#### Custom events with schema

```ts
const OrderDetailSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  amount: z.number(),
})

defineRoute({
  filters: {
    sources: ['myapp.orders'],
    detailTypes: ['Order Created', 'Order Updated'],
  },
  detailSchema: OrderDetailSchema,
}).handle(async ({ detailType, detail }) => {
  console.log(`Order ${detail.orderId} - ${detailType}`)
})
```

## Examples

See the [examples/eventbridge](../../examples/eventbridge) directory for complete working examples.

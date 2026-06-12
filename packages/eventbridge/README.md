# @lambda-event-router/eventbridge

EventBridge event routing by source, detail type, account, region, and resources with schema validation.

**Supported AWS Services:** `Amazon EventBridge`

**Available Routers:** `EventBridgeRouter`

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/eventbridge
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


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
    source: 'myapp.orders',
    detailType: 'Order Created',
  },
  detailSchema: z.object({ orderId: z.string(), customerId: z.string() }),
}).handle(async ({ source, detailType, detail }) => {
  console.log(`Order ${detail.orderId} created for ${detail.customerId}`)
})
eventBridgeRouter.route(processOrder)
```

OR use the separate syntax to split router and handlers across files:

```ts
// eventbridge.ts
import { createEventBridgeRouter } from '@lambda-event-router/eventbridge'
import type { EventBridgeRequest } from '@lambda-event-router/eventbridge'
import { z } from 'zod'

const OrderDetailSchema = z.object({ orderId: z.string(), customerId: z.string() })

const eventBridgeRouter = createEventBridgeRouter()

// Separate handler to define routes and handlers in different places
eventBridgeRouter.route({
  filters: {
    source: 'myapp.orders',
    detailType: 'Order Created',
  },
  detailSchema: OrderDetailSchema,
  handler: processOrder,
})

// route() can not infer the detail type, so annotate the request yourself
type OrderDetail = z.infer<typeof OrderDetailSchema>

export async function processOrder({ source, detailType, detail }: EventBridgeRequest<OrderDetail>) {
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
    source: 'myapp.orders',
    detailType: ['Order Created', 'Order Updated'],
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
    source: 'myapp.orders',
    detailType: ['Order Created', 'Order Updated'],
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
    source: 'aws.ec2',
    detailType: 'EC2 Instance State-change Notification',
    account: '123456789012',
    region: 'us-east-1',
    resource: 'arn:aws:ec2:us-east-1:123456789:instance/i-1234',
    custom: ({ detail }) => isObject(detail) && detail.state === 'running',
  },
})
```

#### AWS service events

```ts
// EC2 state changes - types are automatically inferred
defineRoute({
  filters: {
    source: 'aws.ec2',
    detailType: 'EC2 Instance State-change Notification',
  },
}).handle(async ({ detail, account, region, time }) => {
  console.log(`Instance ${detail['instance-id']} changed to ${detail.state}`)
})

// Scheduled rules
defineRoute({
  filters: {
    source: 'aws.events',
    detailType: 'Scheduled Event',
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
    source: 'myapp.orders',
    detailType: ['Order Created', 'Order Updated'],
  },
  detailSchema: OrderDetailSchema,
}).handle(async ({ detailType, detail }) => {
  console.log(`Order ${detail.orderId} - ${detailType}`)
})
```

## Examples

See the [examples/eventbridge](../../examples/eventbridge) directory for complete working examples.

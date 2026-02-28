# @lambda-event-router/kafka

Apache Kafka routing for both Amazon MSK and self-managed Kafka clusters. Routes messages by topic, partition, and key with schema validation.

**Supported AWS Services:** `Amazon MSK` | `Self-managed Apache Kafka`

**Available Routers:** `KafkaRouter`

## Install

```bash
npm install @lambda-event-router/kafka
```


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { kafkaRouter } from './kafka'

const lambdaRouter = new LambdaRouter({
  routers: [kafkaRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// kafka.ts
import { createKafkaRouter, defineRoute } from '@lambda-event-router/kafka'
import { z } from 'zod'

const kafkaRouter = createKafkaRouter()

// Inline functions allows Typescript to automatic infer types
const processMessage = defineRoute({
  filters: { topics: ['order-events'] },
  valueSchema: z.object({ orderId: z.string(), total: z.number() }),
}).handle(async ({ value, key, topic, partition, offset }) => {
  console.log(`Order ${value.orderId} from ${topic}[${partition}] at offset ${offset}`)
})
kafkaRouter.route(processMessage)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// kafka.ts
import { createKafkaRouter } from '@lambda-event-router/kafka'

const kafkaRouter = createKafkaRouter()

// Separate handler to define routes and handlers in different places
kafkaRouter.route({
  filters: { topics: ['order-events'] },
  valueSchema: ValueSchema,
  handler: processMessage,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processMessage({ value, key, topic, partition, offset }) {
  console.log(`Order ${value.orderId} from ${topic}[${partition}] at offset ${offset}`)
}
```


## Usage

#### Inline handlers

```ts
import { createKafkaRouter, defineRoute } from '@lambda-event-router/kafka'

const kafkaRouter = createKafkaRouter()

const processMessage = defineRoute({
  filters: { topics: ['order-events'] },
  valueSchema: ValueSchema,
}).handle(async ({ value, key, topic, partition, offset }) => {
  console.log(`Order ${value.orderId} from ${topic}[${partition}] at offset ${offset}`)
})

kafkaRouter.route(processMessage)
```

#### Separate handlers

```ts
import { createKafkaRouter } from '@lambda-event-router/kafka'

const kafkaRouter = createKafkaRouter()

kafkaRouter.route({
  filters: { topics: ['order-events'] },
  valueSchema: ValueSchema,
  handler: processMessage,
})

async function processMessage({ value, key, topic, partition, offset }) {
  console.log(`Order ${value.orderId} from ${topic}[${partition}] at offset ${offset}`)
}
```

#### Filters

```ts
defineRoute({
  filters: {
    topics: ['order-events'],
    eventSourceArns: ['arn:aws:kafka:us-east-1:123456789:cluster/my-cluster'],
    bootstrapServers: ['broker1:9092'],
    customFilter: ({ value }) => value.priority === 'HIGH',
  },
})
```

## Examples

See the [examples/kafka](../../examples/kafka) directory for complete working examples.

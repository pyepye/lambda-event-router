# @lambda-event-router/kafka

Routes each record in a Kafka batch to a handler by topic or broker, for Amazon MSK and self-managed clusters. The router decodes the key, value and headers, and runs records in order.

**Supported AWS Services:** `Amazon MSK` | `Self-managed Apache Kafka`

**Available Routers:** `KafkaRouter`

**Docs:** [KafkaRouter](https://pyepye.github.io/lambda-event-router/routers/KafkaRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/kafka
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { kafkaRouter } from './kafka'

const lambdaRouter = new LambdaRouter({
  routers: [kafkaRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// kafka.ts
import { createKafkaRouter, defineRoute } from '@lambda-event-router/kafka'
import { z } from 'zod'

export const kafkaRouter = createKafkaRouter()

const stockMoved = defineRoute({
  filters: {
    topic: 'stock-movements',
    tombstone: false,
    eventSourceArn: 'arn:aws:kafka:eu-west-2:123456789012:cluster/warehouse/abcd1234-5678-90ab-cdef-1234567890ab-2',
    bootstrapServer: 'b-1.warehouse.abc123.c2.kafka.eu-west-2.amazonaws.com:9098',
  },
  valueSchema: z.object({ sku: z.string(), quantity: z.number() }),
}).handle(async ({ value }) => {
  console.log(`Moved ${value.quantity} of ${value.sku}`)
})

kafkaRouter.route(stockMoved)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/KafkaRouter#annotated-handlers).

## Documentation

- [KafkaRouter](https://pyepye.github.io/lambda-event-router/routers/KafkaRouter) covers every filter, tombstones, message headers, and failures and retries.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/kafka](../../service-examples/kafka) for a deployable app.

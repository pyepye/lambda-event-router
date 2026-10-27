# @latcher/kafka

Routes each record in a Kafka batch to a handler by topic or broker, for Amazon MSK and self-managed clusters. The matcher decodes the key, value and headers, and runs records in order.

**Supported AWS Services:** `Amazon MSK` | `Self-managed Apache Kafka`

**Available Matchers:** `KafkaMatcher`

**Docs:** [KafkaMatcher](https://pyepye.github.io/latcher/matchers/KafkaMatcher)

## Install

```bash
npm install @latcher/base @latcher/kafka
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { kafkaMatcher } from './kafka'

const latcher = new Latcher({
  matchers: [kafkaMatcher],
})

export const handler = latcher.handler()
```

```ts
// kafka.ts
import { createKafkaMatcher, defineRoute } from '@latcher/kafka'
import { z } from 'zod'

export const kafkaMatcher = createKafkaMatcher()

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

kafkaMatcher.route(stockMoved)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/KafkaMatcher#annotated-handlers).

## Documentation

- [KafkaMatcher](https://pyepye.github.io/latcher/matchers/KafkaMatcher) covers every filter, tombstones, message headers, and failures and retries.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/kafka](../../service-examples/kafka) for a deployable app.

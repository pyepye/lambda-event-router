# @latcher/eventbridge

Routes EventBridge events to handlers by source, detail type, account, Region or resource. Your handler gets the validated `detail` payload. Through CloudTrail it also covers AWS services that cannot trigger Lambda directly.

**Supported AWS Services:** `Amazon EventBridge`

**Available Matchers:** `EventBridgeMatcher`

**Docs:** [EventBridgeMatcher](https://pyepye.github.io/latcher/matchers/EventBridgeMatcher)

## Install

```bash
npm install @latcher/base @latcher/eventbridge
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { eventBridgeMatcher } from './eventbridge'

const latcher = new Latcher({
  matchers: [eventBridgeMatcher],
})

export const handler = latcher.handler()
```

```ts
// eventbridge.ts
import { createEventBridgeMatcher, defineRoute } from '@latcher/eventbridge'
import { z } from 'zod'

export const eventBridgeMatcher = createEventBridgeMatcher()

const orderCreated = defineRoute({
  filters: {
    source: 'myapp.orders',
    detailType: 'Order Created',
    account: '123456789012',
    region: 'eu-west-2',
    resource: 'arn:aws:events:eu-west-2:123456789012:event-bus/orders',
  },
  detailSchema: z.object({ orderId: z.string(), total: z.number() }),
}).handle(async ({ detail }) => {
  console.log(`Processing order ${detail.orderId} for ${detail.total}`)
})

eventBridgeMatcher.route(orderCreated)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/EventBridgeMatcher#annotated-handlers).

## Documentation

- [EventBridgeMatcher](https://pyepye.github.io/latcher/matchers/EventBridgeMatcher) covers every filter, schema validation,
  typed detail for AWS events and failures and retries.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/eventbridge](../../service-examples/eventbridge) for a deployable app.

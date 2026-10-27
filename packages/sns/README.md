# @latcher/sns

Routes each SNS notification to a handler by topic, subject or message attribute. The matcher parses the message and converts its attributes before your handler runs.

**Supported AWS Services:** `Amazon SNS`

**Available Matchers:** `SNSMatcher`

**Docs:** [SNSMatcher](https://pyepye.github.io/latcher/matchers/SNSMatcher)

## Install

```bash
npm install @latcher/base @latcher/sns
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { snsMatcher } from './sns'

const latcher = new Latcher({
  matchers: [snsMatcher],
})

export const handler = latcher.handler()
```

```ts
// sns.ts
import { createSNSMatcher, defineRoute } from '@latcher/sns'
import { z } from 'zod'

export const snsMatcher = createSNSMatcher()

const orderCreated = defineRoute({
  filters: {
    topicArn: 'arn:aws:sns:eu-west-2:123456789012:orders',
    subject: 'Order created',
    messageAttributes: { Type: 'OrderCreated' },
  },
  bodySchema: z.object({ orderId: z.string(), total: z.number() }),
}).handle(async ({ body }) => {
  console.log(`Processing order ${body.orderId} for ${body.total}`)
})

snsMatcher.route(orderCreated)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/SNSMatcher#annotated-handlers).

## Documentation

- [SNSMatcher](https://pyepye.github.io/latcher/matchers/SNSMatcher) covers every filter, message attribute types,
  schema validation and failures and retries.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/sns](../../service-examples/sns) for a deployable app.

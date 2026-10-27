# @latcher/sqs

Routes each message in an SQS batch to a handler by queue or message attribute. The matcher parses and validates the body, and can report failed messages back to SQS.

**Supported AWS Services:** `Amazon SQS`

**Available Matchers:** `SQSMatcher`

**Docs:** [SQSMatcher](https://pyepye.github.io/latcher/matchers/SQSMatcher)

## Install

```bash
npm install @latcher/base @latcher/sqs
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { sqsMatcher } from './sqs'

const latcher = new Latcher({
  matchers: [sqsMatcher],
})

export const handler = latcher.handler()
```

```ts
// sqs.ts
import { createSQSMatcher, defineRoute } from '@latcher/sqs'
import { z } from 'zod'

export const sqsMatcher = createSQSMatcher()

const processOrder = defineRoute({
  filters: {
    eventSourceArn: 'arn:aws:sqs:eu-west-2:123456789012:orders',
    messageAttributes: { Type: 'ProcessOrder' },
  },
  bodySchema: z.object({ orderId: z.string(), total: z.number() }),
}).handle(async ({ body }) => {
  console.log(`Processing order ${body.orderId} for ${body.total}`)
})

sqsMatcher.route(processOrder)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/SQSMatcher#annotated-handlers).

## Documentation

- [SQSMatcher](https://pyepye.github.io/latcher/matchers/SQSMatcher) covers every filter, schema validation, message attribute types
  and batch failure reporting.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/sqs](../../service-examples/sqs) for a deployable app.

# @latcher/base

The core package. `Latcher` is the handler you export, and it passes each event to the matcher that owns it. `EventMatcher` handles events that have no AWS envelope, such as direct invocations.

**Supported AWS Services:** `AWS Lambda` (every event source via `Latcher`, direct invocation and custom envelopes via `EventMatcher`)

**Available Matchers:** `Latcher` | `EventMatcher`

**Docs:** [Latcher](https://pyepye.github.io/latcher/matchers/Latcher) | [EventMatcher](https://pyepye.github.io/latcher/matchers/EventMatcher)

## Install

```bash
npm install @latcher/base
```

## Quick Start

Create a matcher for each AWS service your Lambda receives events from, then register them all on one `Latcher`. Export its handler.

```ts
// main handler
import { Latcher } from '@latcher/base'
import { apiMatcher } from './api'
import { sqsMatcher } from './sqs'

const latcher = new Latcher({
  matchers: [apiMatcher, sqsMatcher],
})

export const handler = latcher.handler()
```

```ts
// api.ts
import { createAPIGatewayMatcher } from '@latcher/apigateway'
import { getOrder } from './order/get'

export const apiMatcher = createAPIGatewayMatcher()

apiMatcher.route({
  filters: { method: 'GET', path: '/order/:id' },
  handler: getOrder,
})
```

```ts
// sqs.ts
import { createSQSMatcher } from '@latcher/sqs'
import { processOrder } from './order/process'
import { refundOrder } from './order/refund'

export const sqsMatcher = createSQSMatcher()

sqsMatcher.route({
  filters: { messageAttributes: { Type: 'ProcessOrder' } },
  handler: processOrder,
})

sqsMatcher.route({
  filters: { messageAttributes: { Type: 'RefundOrder' } },
  handler: refundOrder,
})
```

`Latcher` works out which matcher owns each event, and that matcher picks the route.

Events with no AWS envelope, such as a direct `Invoke` or an EventBridge Scheduler payload, go to
`EventMatcher`. It has no fields to filter on, so a `custom` filter identifies each route:

```ts
// events.ts
import { createEventMatcher, defineEventRoute, isObject } from '@latcher/base'
import { z } from 'zod'

export const eventMatcher = createEventMatcher()

const generateReport = defineEventRoute({
  filters: {
    custom: ({ event }) => isObject(event) && event.command === 'generate-report',
  },
  eventSchema: z.object({ command: z.literal('generate-report'), reportId: z.string() }),
}).handle(async ({ event }) => {
  console.log(`Generating report ${event.reportId}`)
  return { reportId: event.reportId }
})

eventMatcher.route(generateReport)
```

## Documentation

- [Latcher](https://pyepye.github.io/latcher/matchers/Latcher) covers picking a matcher, options, middleware and custom matchers.
- [EventMatcher](https://pyepye.github.io/latcher/matchers/EventMatcher) covers which events reach it, filters, schema validation and
  failures.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

- [service-examples](../../service-examples) has one deployable app per AWS service. Each one registers its service matchers on a `Latcher`.
- [full-examples](../../full-examples) has apps that chain several AWS services, with one `Latcher` combining several matchers in each Lambda.

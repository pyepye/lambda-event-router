# @lambda-event-router/testing

Test helpers for lambda-event-router. Builds realistic AWS events with sensible defaults, so you only set
the fields your test cares about.

**Docs:** [Testing](https://pyepye.github.io/lambda-event-router/testing/)

## Install

```bash
npm install --save-dev @lambda-event-router/testing vitest
```

## Quick Start

Import `test` from this package in place of `test` from `vitest`. Every builder is then a fixture in the
test callback.

```ts
import { createSQSRouter } from '@lambda-event-router/sqs'
import { test } from '@lambda-event-router/testing'
import { expect, vi } from 'vitest'

const queueArn = 'arn:aws:sqs:eu-west-2:123456789012:orders'
const processOrder = vi.fn()

const sqsRouter = createSQSRouter()
sqsRouter.route({ filters: { eventSourceArn: queueArn }, handler: processOrder })

test('processes an order message', async ({ sqsRecord, sqsHandlerEvent }) => {
  const record = sqsRecord({ eventSourceARN: queueArn, body: { orderId: '123' } })
  const { event, context } = sqsHandlerEvent({ records: [record] })

  await sqsRouter.handleEvent(event, context)

  expect(processOrder).toHaveBeenCalledWith(expect.objectContaining({ body: { orderId: '123' } }))
})
```

## Documentation

- [Testing](https://pyepye.github.io/lambda-event-router/testing/) covers the fixtures, builders, mock context, mock schemas and where to import
  each event type from.

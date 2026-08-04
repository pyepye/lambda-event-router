# @lambda-event-router/testing

Test helpers for lambda-event-router. Builds realistic AWS events with sensible defaults, so you only set
the fields your test cares about.

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

## Usage

### Builders

Every fixture is also exported as a `create` function. Record builders take overrides, event builders
take an array of records and handler event builders take `{ records, context }`.

```ts
import { createSQSEvent, createSQSRecord } from '@lambda-event-router/testing'

const record = createSQSRecord({ body: { orderId: '123' } })
const event = createSQSEvent([record])
```

### Mock context

```ts
import { createMockContext } from '@lambda-event-router/testing'

const context = createMockContext({ functionName: 'orders' })
```

### Mock schemas

`createMockSchema` returns a Standard Schema whose `validate` is a `vi.fn()`. With no arguments it passes
every input through. Pass a result to force a failure:

```ts
import { createMockSchema } from '@lambda-event-router/testing'

const bodySchema = createMockSchema({ issues: [{ message: 'orderId is required' }] })
```

For the full list of builders and where to import each event type from, see the
[testing docs](../../docs/testing/index.md).

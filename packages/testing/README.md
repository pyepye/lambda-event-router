# @lambda-event-router/testing

Testing utilities for lambda-event-router. Provides event creators, record builders, and test fixtures for all supported AWS services.

## Install

```bash
npm install --save-dev @lambda-event-router/testing
```

## Quick Start

```ts
import { test } from '@lambda-event-router/testing'

test('handles SQS message', async ({ sqsRecord, sqsEvent, context }) => {
  const record = sqsRecord({ body: { name: 'Test Item' } })
  const event = sqsEvent({ records: [record] })

  await handler(event, context)
})
```

## Usage

### Creating events

```ts
import {
  createSQSEvent,
  createSNSEvent,
  createKinesisEvent,
  createDynamoDBEvent,
  createS3Event,
  createEventBridgeEvent,
} from '@lambda-event-router/testing'

const sqsEvent = createSQSEvent({ records: [{ body: '{"name": "test"}' }] })
const snsEvent = createSNSEvent({ records: [{ Sns: { Message: '{"name": "test"}' } }] })
```

### All event builders

`allEventBuilders()` returns every event builder as a `[name, build]` pair, so one assertion can run
across all of them.

```ts
import { allEventBuilders } from '@lambda-event-router/testing'

const ownEvents = ['createSQSEvent']

test.each(allEventBuilders())('%s', async (name, build) => {
  const event = build()
  const isOwnEvent = ownEvents.includes(name)

  const claimed = await createSQSRouter().canHandleEvent(event)

  expect(claimed).toBe(isOwnEvent)
})
```

Each router test file ends with this, asserting the router claims its own events and nobody else's. Adding a builder
here fails those tests until every router says whether it claims the new event.

### Creating records

```ts
import {
  createSQSRecord,
  createSNSRecord,
  createKinesisRecord,
  createDynamoDBInsertRecord,
  createDynamoDBModifyRecord,
  createDynamoDBRemoveRecord,
} from '@lambda-event-router/testing'

const record = createSQSRecord({ body: '{"orderId": "123"}' })
```

### Mock context

```ts
import { createMockContext } from '@lambda-event-router/testing'

const context = createMockContext()
```

### Vitest fixtures

This package exports `test`. A pre-configured version of [Vitest's `test.extend`](https://vitest.dev/guide/test-context.html#test-extend) with fixtures for every supported AWS service pre-loaded. Use it as a drop-in replacement for `test` from `vitest`. Any fixture you destructure in the test callback is lazily created for you:

```ts
import { test } from '@lambda-event-router/testing'

test('handles SQS message', async ({ sqsRecord, sqsEvent, context }) => {
  const record = sqsRecord({ body: { name: 'Test Item' } })
  const event = sqsEvent({ records: [record] })

  await handler(event, context)
})
```

Under the hood this is equivalent to:

```ts
import { test as viTest } from 'vitest'
import { sqsFixtures, contextFixtures } from '@lambda-event-router/testing'

const test = viTest.extend({ ...sqsFixtures, ...contextFixtures })
```

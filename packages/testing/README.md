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

This package exports `test` — a pre-configured version of [Vitest's `test.extend`](https://vitest.dev/guide/test-context.html#test-extend) with fixtures for every supported AWS service pre-loaded. Use it as a drop-in replacement for `test` from `vitest`. Any fixture you destructure in the test callback is lazily created for you:

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

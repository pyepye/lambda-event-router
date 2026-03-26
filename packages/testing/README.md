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

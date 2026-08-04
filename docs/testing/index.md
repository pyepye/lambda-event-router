# Testing

`@lambda-event-router/testing` builds realistic AWS events for your tests, so you don't have to copy
event JSON into every test file. It works with [Vitest](https://vitest.dev/), and every builder fills in
sensible defaults, so you only set the fields your test cares about.

```bash
npm install --save-dev @lambda-event-router/testing vitest
```

## Fixtures

Import `test` from the package in place of `test` from `vitest`. Every builder is then available as a
fixture in the test callback.

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

To break down the test, we are:

1. Building an SQS record from our queue, with an object body that the builder turns into a JSON string
2. Wrapping the record in an event, with a mock Lambda `context` to go with it
3. Passing both to the router's `handleEvent`, which runs the same matching and parsing as it would in Lambda

Every router has `handleEvent`, so the same pattern works for all of them. You don't need a
[`LambdaRouter`](/routers/LambdaRouter) in your tests unless you are testing which router claims an event.

## Builders

Every fixture is also exported as a function, usually named `create` plus the fixture name. `sqsRecord`
is `createSQSRecord`, `sqsEvent` is `createSQSEvent` and so on. Use them when you want an event outside
a test callback.

A few names don't follow the pattern:

| Fixture | Function |
| --- | --- |
| `context` | `createMockContext` |
| `dynamoDBStreamEvent` | `createDynamoDBEvent` |
| `dynamoDBStreamHandlerEvent` | `createDynamoDBHandlerEvent` |
| `kafkaMSKEvent` | `createMSKEvent` |
| `kafkaSelfManagedEvent` | `createSelfManagedKafkaEvent` |
| `secretsManagerEvent` | `createSecretsManagerRotationEvent` |

Most services have builders at three levels:

| Level | Example | Takes |
| --- | --- | --- |
| Record | `createSQSRecord` | Overrides for one record |
| Event | `createSQSEvent` | An array of records |
| Handler event | `createSQSHandlerEvent` | `{ records, context }`, and returns `{ event, context }` |

```ts
import { createDynamoDBEvent, createDynamoDBInsertRecord } from '@lambda-event-router/testing'

const record = createDynamoDBInsertRecord({ newImage: { orderId: '123', total: 42 } })
const event = createDynamoDBEvent([record])
```

Builders take plain values where AWS sends encoded ones, so you never write the encoding yourself. The
DynamoDB builders marshal `keys`, `newImage` and `oldImage` into attribute values, and the SQS builder
stringifies an object `body`.

Services that send one event rather than a batch of records, like EventBridge or API Gateway, skip the
record level. Your editor's autocomplete on `create` lists every builder.

## Mock context

`createMockContext` returns a Lambda `Context` with test values. Pass overrides for anything your code
reads.

```ts
import { createMockContext } from '@lambda-event-router/testing'

const context = createMockContext({ functionName: 'orders' })
```

The handler event builders and the `context` fixture use it for you.

## Mock schemas

`createMockSchema` returns a [Standard Schema](https://github.com/standard-schema/standard-schema) whose
`validate` is a `vi.fn()`. Use it to test a route's schema handling without pulling in Zod or Valibot.

With no arguments it passes every input through unchanged. Pass a result to force the outcome, for
example a failure:

```ts
import { SchemaValidationError } from '@lambda-event-router/base'
import { createSQSRouter } from '@lambda-event-router/sqs'
import { createMockSchema, test } from '@lambda-event-router/testing'
import { expect, vi } from 'vitest'

test('rejects an invalid body', async ({ sqsHandlerEvent }) => {
  const bodySchema = createMockSchema({ issues: [{ message: 'orderId is required' }] })
  const processOrder = vi.fn()

  const sqsRouter = createSQSRouter()
  sqsRouter.route({ filters: {}, bodySchema, handler: processOrder })

  const { event, context } = sqsHandlerEvent()

  await expect(sqsRouter.handleEvent(event, context)).rejects.toThrow(SchemaValidationError)
  expect(processOrder).not.toHaveBeenCalled()
})
```

The return type is exported as `MockSchema` if you need to name it.

## Event types

Most builders return a type from `@types/aws-lambda`. The services below use their own type instead,
and you import it from the router package.

| Package | Types |
| --- | --- |
| `@lambda-event-router/documentdb` | `DocumentDBEvent`, `DocumentDBChangeEvent`, `DocumentDBEventEntry`, `DocumentDBOperationType`, `DocumentDBUpdateDescription` |
| `@lambda-event-router/kafka` | `KafkaMSKEvent`, `KafkaSelfManagedEvent`, `KafkaRetryEvent`, `KafkaRecord`, `KafkaRecordHeader` |
| `@lambda-event-router/mq` | `ActiveMQDestination`, `ActiveMQMessageType`, `RabbitMQBasicProperties`, `RabbitMQHeaderValue` |
| `@lambda-event-router/vpclattice` | `VPCLatticeEventV1`, `VPCLatticeEventV2`, `VPCLatticeRequestContextV2` |
| `@lambda-event-router/apigateway` | `WebSocketEvent` |
| `@lambda-event-router/appsync` | `AppSyncEventsPublishedEvent` |
| `@lambda-event-router/secretsmanager` | `SecretsManagerEvent` |

```ts
import type { DocumentDBChangeEvent } from '@lambda-event-router/documentdb'
import { createDocumentDBChangeEvent } from '@lambda-event-router/testing'

const change: DocumentDBChangeEvent = createDocumentDBChangeEvent()
```

The package also exports the types for its own builders, such as `SQSRecordOverrides` and
`SQSHandlerEvent`, if you want to write helpers around them.

# Middleware

Middleware is a function that wraps your handler. It can run code before the handler, after it, or in
place of it.

It is where work that is not a handler's business logic goes: timing, tracing, auth checks, deciding
what a failure means. Write it once and it covers as many handlers as you point it at, rather than
being the same few lines in ten files, drifting apart as they get edited.

You attach it in three places, and they run in this order:

1. `Latcher`, so it covers every event the Lambda receives
2. A matcher, so it covers every route on that matcher
3. A single route

## Execution order

Middleware nests rather than queues, so every layer gets control twice. Once when the event reaches it,
and again once everything inside it has finished.

```
                  ┌────────────────────────────────────────────────┐
   event ───────► │ Latcher middleware          before next() │
                  │ ┌────────────────────────────────────────────┐ │
                  │ │ Matcher middleware            before next() │ │
                  │ │ ┌────────────────────────────────────────┐ │ │
                  │ │ │ Route middleware         before next() │ │ │
                  │ │ │ ┌────────────────────────────────────┐ │ │ │
                  │ │ │ │ Handler                            │ │ │ │
                  │ │ │ └────────────────────────────────────┘ │ │ │
                  │ │ │ Route middleware          after next() │ │ │
                  │ │ └────────────────────────────────────────┘ │ │
                  │ │ Matcher middleware             after next() │ │
                  │ └────────────────────────────────────────────┘ │
  result ◄─────── │ Latcher middleware           after next() │
                  └────────────────────────────────────────────────┘
```

`next()` hands over to the layer below and comes back with whatever it returned. The two halves of a
middleware are the code either side of that call, and everything middleware can do comes from where you
put your code relative to it.

| What you want | How |
| --- | --- |
| Run before the handler | Code above `next(request)` |
| Run after the handler | Code below `await next(request)` |
| Change what the handler is given | `next({ ...request, body })` |
| Change what the matcher gets back | Return something other than what `next` gave you |
| Recover from a failure | `try` / `catch` around `await next(request)` |
| Stop the handler running | Return without calling `next` |

Within a level they run in array order, so `middleware: [withAuth, withAudit]` puts `withAuth` on the
outside and gives it the last word on the way back out.

**Matcher and route middleware only run once a route has matched and its schemas have passed.** An
event that matched nothing never reaches them, and neither does one whose data a schema rejected. See
[nothing matched](/docs/routing#nothing-matched) and
[validation failures](/docs/routing#validation-failures) for what happens to those instead.

Calling `next()` more than once in a single matcher or route middleware throws
`next() called multiple times within a single middleware`.

## Where middleware attaches

| Level | Passed to | Covers |
| --- | --- | --- |
| Global | `new Latcher({ middleware })` | Every event the Lambda receives |
| Matcher | `create<Source>Matcher({ middleware })` | Every route on that matcher |
| Route | `route({ middleware })` | That route only |

Record based matchers call the handler once per record, and matcher and route middleware go with it, so
a batch of ten messages runs them ten times. Global middleware runs once for the whole batch.

Matcher and route middleware use the typed alias each package exports, so `SQSMiddleware` and
`KinesisMiddleware`. See [types](#types) for the full picture. Global middleware has its own signature,
covered below.

## Global middleware

`Latcher` middleware runs for every event, whichever matcher ends up taking it, so tracing, timing
and per-invocation logger keys only need writing once instead of on each matcher. Matcher middleware is
where work specific to one event source goes.

**It has a different signature to the other two.** No matcher has been picked yet, so there is no
request object to give you and you get the raw event and the Lambda context instead.

```ts
import type { Handler } from 'aws-lambda'
import { Latcher, logger, type LambdaMiddleware } from '@latcher/base'

import { apiMatcher } from './matchers/api.js'
import { sqsMatcher } from './matchers/sqs.js'

const withTiming: LambdaMiddleware = async (event, context, next) => {
  const startedAt = Date.now()
  logger.appendKeys({ requestId: context.awsRequestId })

  try {
    return await next(event, context)
  } finally {
    logger.info('Invocation finished', { durationMs: Date.now() - startedAt })
  }
}

const latcher = new Latcher({
  matchers: [apiMatcher, sqsMatcher],
  middleware: [withTiming],
})

export const handler: Handler = latcher.handler()
```

The signature is exported as `LambdaMiddleware`.

`Latcher` clears temporary logger keys at the start of every invocation, before any middleware
runs, so keys you add here cannot be left over from the previous event in a warm container. See
[logging](/docs/logging#per-invocation-keys).

**Calling `next()` twice in global middleware routes and handles the event twice instead of throwing.**
The guard against that lives in the matcher and route chain, not this one.

## Matcher middleware

Matcher middleware covers every route on one matcher and gets that matcher's request object, with
filters, parsing and schemas already applied.

```ts
import { logger } from '@latcher/base'
import { createKinesisMatcher, type KinesisMiddleware } from '@latcher/kinesis'

export const withRecordTiming: KinesisMiddleware = async (request, next) => {
  const startedAt = Date.now()

  try {
    return await next(request)
  } finally {
    logger.info('Record handled', {
      partitionKey: request.partitionKey,
      durationMs: Date.now() - startedAt,
    })
  }
}

export const kinesisMatcher = createKinesisMatcher({ middleware: [withRecordTiming] })
```

On a record based matcher that times one record rather than the batch, because the whole chain runs per
record.

**Records in an SQS or SNS batch are processed in parallel, so per-record state on the shared logger
bleeds across records.** Pass what you need on each log call, as above, rather than reaching for
`appendKeys`. Kinesis, DynamoDB Streams and S3 take their records one at a time.

## Route middleware

Route middleware wraps a single route and is the innermost layer before your handler. Auth on one
endpoint, or a fallback that only makes sense for one message type.

```ts
import type { HTTPMiddleware } from '@latcher/apigateway'
import { Unauthorized } from '@latcher/apigateway'

import { apiKeys } from '../services/apiKeys.js'

export const withApiKey: HTTPMiddleware = async (request, next) => {
  const key = request.headers['x-api-key']
  if (!key || !(await apiKeys.isValid(key))) {
    return Unauthorized('Provide a valid x-api-key header')
  }

  return next(request)
}
```

```ts
apiMatcher.get({
  filters: { path: '/orders/:orderId' },
  handler: getOrder,
})

// Only this route needs a key, so the read above stays open
apiMatcher.post({
  filters: { path: '/orders' },
  middleware: [withApiKey],
  handler: createOrder,
})
```

The HTTP matchers share one type, `HTTPMiddleware`, so the name does not follow the matcher the way
`SQSMiddleware` does. Each package re-exports it, so import it from the matcher's own package.

## Stopping the handler

Returning without calling `next` skips everything inside that layer, the handler included. What that
means depends on the event source.

::: code-group

```ts [SNS]
// Nothing is retried, the record counts as handled
export const skipMuted: SNSMiddleware = async (request, next) => {
  if (request.messageAttributes.muted === 'true') {
    logger.info('Muted notification, nothing to send', { messageId: request.record.Sns.MessageId })
    return
  }

  return next(request)
}
```

```ts [API Gateway]
// The matcher still owes the caller a response, so return one
export const withMaintenanceWindow: HTTPMiddleware = async (request, next) => {
  if (await maintenance.isActive()) {
    return new HTTPException(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE, 'Orders are read only until 06:00 UTC')
  }

  return next(request)
}
```

:::

There is no helper for a 503, so that one returns an `HTTPException` with the status. An HTTP
middleware can also throw a response helper rather than returning it, which is the readable option once
the check sits a few calls below the middleware itself. See [handlers](/docs/handlers#throwing).

## Failing and recovering

Throwing from middleware fails the invocation the same way throwing from a handler does, so it is a
reasonable place to reject a message you cannot process. On a record based matcher that fails the
record rather than the batch, as long as the matcher reports per record failures.

Middleware on the way out can also catch what the handler threw. Swallowing the error marks the record
as handled, so decide deliberately rather than catching everything.

```ts
import { logger } from '@latcher/base'
import type { SQSMiddleware } from '@latcher/sqs'

import { quarantine } from '../services/quarantine.js'

export const withQuarantine: SQSMiddleware = async (request, next) => {
  try {
    return await next(request)
  } catch (error) {
    if (Number(request.record.attributes.ApproximateReceiveCount) < 3) throw error

    logger.warn('Quarantining message after three attempts', { error })
    await quarantine.send(request.body)
  }
}
```

Rethrowing on the first two attempts leaves redelivery alone, and the third swallows the error so the
message stops coming back. Each [matcher page](/packages) covers what failure costs on its own event
source.

## Types

`Middleware<TRequest, TResponse>` comes from `base` and is the shape of all matcher and route
middleware.

```ts
type Middleware<TRequest, TResponse> = (
  request: TRequest,
  next: (request: TRequest) => Promise<TResponse>,
) => Promise<TResponse>
```

Every package exports an alias with its own request and response filled in, so `SQSMiddleware` is
`Middleware<SQSRequest, void>` and `CognitoMiddleware` is `Middleware<CognitoRequest, CognitoEvent>`.
Reach for the alias, since the base type leaves you naming both parameters yourself.

Each alias also takes the payload type, so `SQSMiddleware<Order>` reads `request.body` as an `Order`.
Type route middleware this way when the route has a schema. Matcher middleware takes no type argument,
because it runs for every route. Each matcher page lists the parameters its alias takes.

```ts
import { logger } from '@latcher/base'
import type { EventBridgeMiddleware } from '@latcher/eventbridge'

export const withEventContext: EventBridgeMiddleware = async (request, next) => {
  logger.appendKeys({ eventId: request.id, detailType: request.detailType })

  return next(request)
}
```

Most packages name it `<Source>Middleware`, so `SQSMiddleware`, `DynamoDBMiddleware` and
`CognitoMiddleware`. These do not follow that:

| Matcher | Type | Imported from |
| --- | --- | --- |
| `APIGatewayMatcher`, `ALBMatcher`, `VPCLatticeMatcher` | `HTTPMiddleware` | The matcher's own package, which re-exports it |
| `AppSyncMatcher` | `AppSyncResolverMiddleware` | `@latcher/appsync` |
| `ActiveMQMatcher`, `RabbitMQMatcher` | `ActiveMQMiddleware`, `RabbitMQMiddleware` | `@latcher/mq` |
| `CloudWatchLogsMatcher` | `CloudWatchLogsMiddleware` | `@latcher/cloudwatch` |
| `S3Matcher` | `S3Middleware` | `@latcher/s3` |
| `S3BatchMatcher` | `S3BatchMiddleware` | `@latcher/s3` |
| `EventMatcher` | `EventMatcherMiddleware` | `@latcher/base` |
| `StepFunctionsMatcher` | `StepFunctionsMiddleware`, and `StepFunctionsTaskTokenMiddleware` on a callback route | `@latcher/stepfunctions` |

## Full example

An orders Lambda taking API Gateway requests and SQS messages, with all three levels wired up. The
global middleware times both, each matcher adds what its event source needs, and one route asks for an
API key.

Open a file: [matchers/api.ts](#middleware-example:matchers/api.ts) |
[matchers/sqs.ts](#middleware-example:matchers/sqs.ts) |
[middleware/withTiming.ts](#middleware-example:middleware/withTiming.ts) |
[middleware/withApiKey.ts](#middleware-example:middleware/withApiKey.ts) |
[index.ts](#middleware-example:index.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { withTiming } from './middleware/withTiming.js'
import { apiMatcher } from './matchers/api.js'
import { sqsMatcher } from './matchers/sqs.js'

// One place to cover every event this Lambda receives
const latcher = new Latcher({
  matchers: [apiMatcher, sqsMatcher],
  middleware: [withTiming],
})

export const handler: Handler = latcher.handler()`,
  },
  {
    path: 'middleware/withTiming.ts',
    code: `import { logger, type LambdaMiddleware } from '@latcher/base'

// Global middleware gets the raw event and the Lambda context
export const withTiming: LambdaMiddleware = async (event, context, next) => {
  const startedAt = Date.now()
  logger.appendKeys({ requestId: context.awsRequestId })

  try {
    return await next(event, context)
  } finally {
    logger.info('Invocation finished', { durationMs: Date.now() - startedAt })
  }
}`,
  },
  {
    path: 'middleware/withRequestLog.ts',
    code: `import type { HTTPMiddleware } from '@latcher/apigateway'
import { logger } from '@latcher/base'

// Logs on the way out, so the status code and duration are known
export const withRequestLog: HTTPMiddleware = async (request, next) => {
  const response = await next(request)
  logger.info('Request handled', { method: request.method, path: request.path })

  return response
}`,
  },
  {
    path: 'middleware/withApiKey.ts',
    code: `import type { HTTPMiddleware } from '@latcher/apigateway'
import { Unauthorized } from '@latcher/apigateway'

import { apiKeys } from '../services/apiKeys.js'

// Returning without calling next() means the handler never runs
export const withApiKey: HTTPMiddleware = async (request, next) => {
  const key = request.headers['x-api-key']
  if (!key || !(await apiKeys.isValid(key))) {
    return Unauthorized('Provide a valid x-api-key header')
  }

  return next(request)
}`,
  },
  {
    path: 'middleware/withRecordTiming.ts',
    code: `import { logger } from '@latcher/base'
import type { SQSMiddleware } from '@latcher/sqs'

// Runs once per record, and records in a batch run in parallel, so the ids go on the log call
export const withRecordTiming: SQSMiddleware = async (request, next) => {
  const startedAt = Date.now()

  try {
    return await next(request)
  } finally {
    logger.info('Record handled', {
      messageId: request.record.messageId,
      durationMs: Date.now() - startedAt,
    })
  }
}`,
  },
  {
    path: 'middleware/withQuarantine.ts',
    code: `import { logger } from '@latcher/base'
import type { SQSMiddleware } from '@latcher/sqs'

import { quarantine } from '../services/quarantine.js'

// Rethrowing leaves redelivery alone, swallowing marks the record as handled
export const withQuarantine: SQSMiddleware = async (request, next) => {
  try {
    return await next(request)
  } catch (error) {
    if (Number(request.record.attributes.ApproximateReceiveCount) < 3) throw error

    logger.warn('Quarantining message after three attempts', { error })
    await quarantine.send(request.body)
  }
}`,
  },
  {
    path: 'matchers/api.ts',
    code: `import { createAPIGatewayMatcher } from '@latcher/apigateway'

import { createOrder } from '../handlers/createOrder.js'
import { getOrder } from '../handlers/getOrder.js'
import { withApiKey } from '../middleware/withApiKey.js'
import { withRequestLog } from '../middleware/withRequestLog.js'

// Matcher middleware covers both routes below
export const apiMatcher = createAPIGatewayMatcher({ middleware: [withRequestLog] })

apiMatcher.get({
  filters: { path: '/orders/:orderId' },
  handler: getOrder,
})

// Route middleware wraps this one only, so the read above stays open
apiMatcher.post({
  filters: { path: '/orders' },
  middleware: [withApiKey],
  handler: createOrder,
})`,
  },
  {
    path: 'matchers/sqs.ts',
    code: `import { createSQSMatcher } from '@latcher/sqs'

import { processOrder } from '../handlers/processOrder.js'
import { withQuarantine } from '../middleware/withQuarantine.js'
import { withRecordTiming } from '../middleware/withRecordTiming.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const sqsMatcher = createSQSMatcher({
  batchItemFailures: true,
  middleware: [withRecordTiming],
})

// withQuarantine only rethrows for the first two attempts, so redelivery still works
sqsMatcher.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  middleware: [withQuarantine],
  handler: processOrder,
})`,
  },
]
</script>

<CodeFileViewer :files="files" id="middleware-example" default-file="matchers/api.ts" line-numbers collapse-toggle fixed-height />

Each [matcher page](/packages) lists its own middleware type alongside the options it accepts.

# Latcher

`Latcher` is the entry point. It takes every matcher in your Lambda and works out which one owns
each event before any of your filters run.

You export what `handler()` gives you, so AWS invokes `Latcher` and `Latcher` invokes
everything else. It has no routes, no filters and no schemas of its own, because those belong to the
service matchers you register on it.

## Install

```bash
npm install @latcher/base
```

Every service package pulls `base` in, so it may already be in your tree. Install it by name anyway,
since a package you import from belongs in your own `package.json`.

## Create the matcher

```ts
import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { apiMatcher } from './api.js'
import { withTiming } from './middleware/withTiming.js'
import { sqsMatcher } from './sqs.js'

const latcher = new Latcher({
  matchers: [apiMatcher, sqsMatcher],
  middleware: [withTiming],  // Optional
})

export const handler: Handler = latcher.handler()
```

`matchers` is the only required option.

`createLatcher({ matchers: [apiMatcher, sqsMatcher] })` is the same call in the factory form the
service matchers use, so pick whichever reads better to you.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `matchers` | `EventTypeMatcher[]` | Yes | | Every matcher this Lambda can receive events for. See [Picking a matcher](#picking-a-matcher) |
| `middleware` | `LambdaMiddleware[]` | No | `[]` | Runs for every event, whichever matcher takes it. See [Middleware](#middleware) |

The options object is typed `LatcherOptions` and a global middleware function is typed
`LambdaMiddleware`, both exported from `@latcher/base`.

## Export the handler

`handler()` returns an `aws-lambda` `Handler`. Call it once at module scope and export the result,
which is the function you point your Lambda's handler setting at.

Whatever the matched matcher returned comes back untouched. An HTTP matcher's status code and body reach
API Gateway as they are, an SQS matcher reporting batch item failures returns those, and a matcher whose
handlers return nothing resolves to `undefined`.

## Picking a matcher

`Latcher` asks each matcher in turn whether it recognises the event, through the `canHandleEvent`
method every matcher has, and gives the event to the first one that says yes.

Each answer is awaited before the next matcher is asked, so a matcher can decide asynchronously.
`EventMatcher` and `StepFunctionsMatcher` return a promise, because they run your `custom` before
answering.

None of that is yours to write. Each matcher recognises its own event source from the shape AWS sends,
so adding a second matcher cannot change how the first one's events are routed.

### Claiming an event and then missing

A matcher that claims an event and then finds none of its own routes match throws `NoRouteMatchedError`,
and `Latcher` carries on down the list rather than failing.

`EventMatcher` and `StepFunctionsMatcher` sit on one Lambda without needing that. A custom JSON payload
gives neither of them a shape to recognise, so both ask their own routes before claiming and the order
you register in makes no difference.

```ts
// Either order works. The TaskToken payload matches a route on one and not the other
const latcher = new Latcher({
  matchers: [stepFunctionsMatcher, eventMatcher],
})
```

**Only that error falls through.** Anything else fails the invocation, a failing `eventSchema`
included, so a malformed payload cannot end up handled by a matcher that was never meant to see it.

### One matcher per event source

Put every route for one event source on one matcher. The HTTP and record matchers do not fall through, so
a second instance of one never receives anything: the first claims the event, then answers its own 404
or throws.

**So splitting an API across two `APIGatewayMatcher` instances does not work.** Both recognise every
request, the first one takes them all, and a path only the second has a route for comes back as the
first matcher's 404 rather than reaching it.

### Catch-all matchers

`EventMatcher` claims an event when one of its own routes matches, so a `custom` returning `true`
for anything claims everything. `Latcher` sorts `EventMatcher` to the end of the list whatever
order you registered in, which gives every dedicated matcher first refusal on its own events.

`StepFunctionsMatcher` does the same for any object it does not recognise as one of a short list of AWS
event shapes. `Latcher` sorts it after the dedicated matchers as well, and ahead of
`EventMatcher`.

## No matcher for the event

An event no matcher recognises throws `No matcher found for event`, which fails the invocation. This
happens before any route matching, so no filter of yours has run and nothing has been validated.

An event that was claimed and then matched no route fails with the last claiming matcher's own error
instead, so the message names the matcher that got closest.

Reaching the right matcher is not the same as finding a route on it, and the two fail differently. A
request `APIGatewayMatcher` recognises and has no route for is a 404 from that matcher, and an SQS record
with no matching route throws inside `SQSMatcher`.

See [nothing matched](/docs/routing#nothing-matched) for what each matcher does with an event it owns.

`EventMatcher` counts as not recognising the event when none of its routes match, so a custom payload
that misses every `custom` fails here rather than inside `EventMatcher`.

## Middleware

Middleware passed to `Latcher` runs for every event the Lambda receives, whichever matcher ends up
taking it, so tracing, timing and per-invocation logger keys only need writing once.

**It has a different signature to matcher and route middleware.** No matcher has been picked yet, so
there is no request object to hand you and you get the raw event and the Lambda context instead. The
signature is exported as `LambdaMiddleware`.

```ts
import { logger, type LambdaMiddleware } from '@latcher/base'

export const withTiming: LambdaMiddleware = async (event, context, next) => {
  const startedAt = Date.now()
  logger.appendKeys({ requestId: context.awsRequestId })

  try {
    return await next(event, context)
  } finally {
    logger.info(`Invocation finished in ${Date.now() - startedAt}ms`)
  }
}
```

Because it wraps the routing rather than sitting inside it, a `try` / `catch` around `await next()`
also catches `No matcher found for event`, which is the only way to answer an event nothing recognised.

**Calling `next()` twice routes and handles the event twice instead of throwing.** The guard against
that lives in the matcher and route chain, not this one.

See [middleware](/docs/middleware) for the execution order and the three levels it attaches at.

## Per-invocation logger keys

`Latcher` calls `resetKeys()` on the active logger at the start of every invocation, before your
middleware runs. Temporary keys added with `appendKeys()` cannot leak into the next event a warm
container receives.

Keys you want to survive the reset go on with `appendPersistentKeys()`. See
[logging](/docs/logging#per-invocation-keys) for the split between the two.

## Types

Exported from `@latcher/base`.

| Type | Description |
| --- | --- |
| `EventTypeMatcher<TEvent, TResult>` | What every matcher satisfies, and what the `matchers` array holds |
| `LatcherOptions` | Options for `new Latcher` and `createLatcher` |
| `LambdaMiddleware` | A global middleware function, `(event, context, next) => Promise<unknown>` |

The `Latcher` class and the `createLatcher` function come from the same place. `Handler` and
`Context` come from `aws-lambda`, not from this package.

### Generic parameters

`EventTypeMatcher` takes two, and both default to `unknown`.

| Parameter | Types | Default |
| --- | --- | --- |
| `TEvent` | The event `handleEvent` is given | `unknown` |
| `TResult` | What `handleEvent` resolves to | `unknown` |

`matchers` is typed `EventTypeMatcher[]`, so it takes the bare form with both left off. You only need the
parameters when you are writing a matcher of your own.

## Custom matchers

Anything satisfying `EventTypeMatcher` can go in the `matchers` array, so a service with no matcher of its
own is two methods rather than a fork of the library.

```ts
import type { Context } from 'aws-lambda'
import type { EventTypeMatcher } from '@latcher/base'
import { isObject, Latcher, logger } from '@latcher/base'

interface JobEvent {
  jobName: string
  payload: unknown
}

const jobMatcher = {
  canHandleEvent: (event: unknown): boolean => isObject(event) && typeof event.jobName === 'string',

  handleEvent: async (event: JobEvent, context: Context): Promise<{ ran: string }> => {
    logger.info(`Running job ${event.jobName} for request ${context.awsRequestId}`)

    return { ran: event.jobName }
  },
} satisfies EventTypeMatcher<JobEvent, { ran: string }>

const latcher = new Latcher({ matchers: [sqsMatcher, jobMatcher] })
```

`canHandleEvent` may return a promise, and narrowing the event with `isObject` from
`@latcher/base` is what keeps it honest about the `unknown` it is given.

**Recognise as little as you can get away with.** A `canHandleEvent` that returns `true` too readily
takes events a dedicated matcher would have handled, and the only sign is a handler receiving something
it did not expect. `EventMatcher` covers a custom payload with filters and schema validation already, so
reach for a matcher of your own when you need the whole event source rather than one payload shape.

A matcher that recognises an event loosely can throw `NoRouteMatchedError`, exported from
`@latcher/base`, from `handleEvent` to hand the event back, and `Latcher` tries the
next matcher. Throwing it is how a custom matcher opts in.

## Code example

An orders Lambda taking API Gateway requests, SQS messages and a scheduled report payload, with one
middleware timing all three.

Open a file: [index.ts](#lambda-example:index.ts) | [API matcher](#lambda-example:api.ts) | [SQS matcher](#lambda-example:sqs.ts) | [event matcher](#lambda-example:events.ts) | [middleware](#lambda-example:middleware/withTiming.ts) | [handlers](#lambda-example:handlers/orders.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { apiMatcher } from './api.js'
import { eventMatcher } from './events.js'
import { withTiming } from './middleware/withTiming.js'
import { sqsMatcher } from './sqs.js'

// eventMatcher is sorted last whatever order it is written in, so the other two get first refusal
const latcher = new Latcher({
  matchers: [apiMatcher, sqsMatcher, eventMatcher],
  middleware: [withTiming],
})

export const handler: Handler = latcher.handler()`,
  },
  {
    path: 'api.ts',
    code: `import { createAPIGatewayMatcher } from '@latcher/apigateway'

import { getOrder } from './handlers/orders.js'

export const apiMatcher = createAPIGatewayMatcher()

apiMatcher.get({
  filters: { path: '/orders/:orderId' },
  handler: getOrder,
})`,
  },
  {
    path: 'sqs.ts',
    code: `import { createSQSMatcher } from '@latcher/sqs'

import { processOrder } from './handlers/orders.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const sqsMatcher = createSQSMatcher({ batchItemFailures: true })

sqsMatcher.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  handler: processOrder,
})`,
  },
  {
    path: 'events.ts',
    code: `import { createEventMatcher, defineEventRoute, isObject, logger } from '@latcher/base'
import { z } from 'zod'

export const eventMatcher = createEventMatcher()

// EventBridge Scheduler sends the payload you configured, so there is no envelope to filter on
const reportRoute = defineEventRoute({
  filters: {
    custom: ({ event }) => isObject(event) && event.command === 'generate-report',
  },
  eventSchema: z.object({
    command: z.literal('generate-report'),
    day: z.iso.date(),
  }),
}).handle(async ({ event }) => {
  logger.info(\`Building the order report for \${event.day}\`)

  return { day: event.day }
})

eventMatcher.route(reportRoute)`,
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
    logger.info(\`Invocation finished in \${Date.now() - startedAt}ms\`)
  }
}`,
  },
  {
    path: 'handlers/orders.ts',
    code: `import type { ApiRequest, HandlerResponse } from '@latcher/apigateway'
import { logger } from '@latcher/base'
import type { SQSRequest, SQSResponse } from '@latcher/sqs'

import { type Order, orders } from '../services/orders.js'

export async function getOrder(
  request: ApiRequest<{ orderId: string }>,
): Promise<HandlerResponse<Order>> {
  return orders.get(request.path.orderId)
}

export async function processOrder(request: SQSRequest<Order>): Promise<SQSResponse> {
  logger.info(\`Processing order \${request.body.orderId} from the queue\`)
  await orders.process(request.body)
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="lambda-example" default-file="index.ts" line-numbers collapse-toggle fixed-height />

Three event sources, one exported handler and one place that knows about all of them. Each matcher
recognises its own events, so nothing in `index.ts` inspects the event and adding a fourth source
changes nothing about the first three.

`withTiming` covers all three, because it sits above the matcher that ends up taking the event. See
[middleware](/docs/middleware) for the execution order and the three levels it attaches at.

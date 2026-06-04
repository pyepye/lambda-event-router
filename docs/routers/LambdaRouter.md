# LambdaRouter

`LambdaRouter` is the entry point. It takes every router in your Lambda and works out which one owns
each event before any of your filters run.

You export what `handler()` gives you, so AWS invokes `LambdaRouter` and `LambdaRouter` invokes
everything else. It has no routes, no filters and no schemas of its own, because those belong to the
service routers you register on it.

## Install

```bash
npm install @lambda-event-router/base
```

Every service package pulls `base` in, so it may already be in your tree. Install it by name anyway,
since a package you import from belongs in your own `package.json`.

## Create the router

```ts
import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { apiRouter } from './api.js'
import { withTiming } from './middleware/withTiming.js'
import { sqsRouter } from './sqs.js'

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter, sqsRouter],
  middleware: [withTiming],  // Optional
})

export const handler: Handler = lambdaRouter.handler()
```

`routers` is the only required option.

`createLambdaRouter({ routers: [apiRouter, sqsRouter] })` is the same call in the factory form the
service routers use, so pick whichever reads better to you.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `routers` | `EventTypeRouter[]` | Yes | | Every router this Lambda can receive events for. See [Picking a router](#picking-a-router) |
| `middleware` | `LambdaMiddleware[]` | No | `[]` | Runs for every event, whichever router takes it. See [Middleware](#middleware) |

The options object is typed `LambdaRouterOptions` and a global middleware function is typed
`LambdaMiddleware`, both exported from `@lambda-event-router/base`.

## Export the handler

`handler()` returns an `aws-lambda` `Handler`. Call it once at module scope and export the result,
which is the function you point your Lambda's handler setting at.

Whatever the matched router returned comes back untouched. An HTTP router's status code and body reach
API Gateway as they are, an SQS router reporting batch item failures returns those, and a router whose
handlers return nothing resolves to `undefined`.

## Picking a router

`LambdaRouter` asks each router in turn whether it recognises the event, through the `canHandleEvent`
method every router has, and gives the event to the first one that says yes.

Each answer is awaited before the next router is asked, so a router can decide asynchronously.
`EventRouter` does, because it runs your `custom` to make up its mind.

None of that is yours to write. Each router recognises its own event source from the shape AWS sends,
so adding a second router cannot change how the first one's events are routed.

### Claiming an event and then missing

A router that claims an event and then finds none of its own routes match throws `NoRouteMatchedError`,
and `LambdaRouter` carries on down the list rather than failing. That is what lets `EventRouter` and
`StepFunctionsRouter` sit on one Lambda: a custom JSON payload gives neither of them a shape to
recognise, so their routes settle which one owns an event and the order you register in does not.

```ts
// Either order works. The TaskToken payload matches a route on one and not the other
const lambdaRouter = new LambdaRouter({
  routers: [stepFunctionsRouter, eventRouter],
})
```

**Only that error falls through.** Anything else fails the invocation, a failing `eventSchema`
included, so a malformed payload cannot end up handled by a router that was never meant to see it.

### One router per event source

Put every route for one event source on one router. The HTTP and record routers do not fall through, so
a second instance of one never receives anything: the first claims the event, then answers its own 404
or throws.

**So splitting an API across two `APIGatewayRouter` instances does not work.** Both recognise every
request, the first one takes them all, and a path only the second has a route for comes back as the
first router's 404 rather than reaching it.

### Catch-all routers

`EventRouter` claims an event when one of its own routes matches, so a `custom` returning `true`
for anything claims everything. `LambdaRouter` sorts `EventRouter` to the end of the list whatever
order you registered in, which gives every dedicated router first refusal on its own events.

`StepFunctionsRouter` is a catch-all too, claiming any object it does not recognise as one of a short
list of AWS event shapes, far fewer than `EventRouter` knows about. `LambdaRouter` sorts it after the
dedicated routers as well, and ahead of `EventRouter`. A shape it claims but has no route for throws
`NoRouteMatchedError`, which falls through to `EventRouter` as the final fallback.

## No router for the event

An event no router recognises throws `No router found for event`, which fails the invocation. This
happens before any route matching, so no filter of yours has run and nothing has been validated.

An event that was claimed and then matched no route fails with the last claiming router's own error
instead, so the message names the router that got closest.

Reaching the right router is not the same as finding a route on it, and the two fail differently. A
request `APIGatewayRouter` recognises and has no route for is a 404 from that router, and an SQS record
with no matching route throws inside `SQSRouter`.

See [nothing matched](/docs/routing#nothing-matched) for what each router does with an event it owns.

`EventRouter` counts as not recognising the event when none of its routes match, so a custom payload
that misses every `custom` fails here rather than inside `EventRouter`.

## Middleware

Middleware passed to `LambdaRouter` runs for every event the Lambda receives, whichever router ends up
taking it, so tracing, timing and per-invocation logger keys only need writing once.

**It has a different signature to router and route middleware.** No router has been picked yet, so
there is no request object to hand you and you get the raw event and the Lambda context instead. The
signature is exported as `LambdaMiddleware`.

```ts
import { logger, type LambdaMiddleware } from '@lambda-event-router/base'

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
also catches `No router found for event`, which is the only way to answer an event nothing recognised.

**Calling `next()` twice routes and handles the event twice instead of throwing.** The guard against
that lives in the router and route chain, not this one.

See [middleware](/docs/middleware) for the execution order and the three levels it attaches at.

## Per-invocation logger keys

`LambdaRouter` calls `resetKeys()` on the active logger at the start of every invocation, before your
middleware runs. Temporary keys added with `appendKeys()` cannot leak into the next event a warm
container receives.

Keys you want to survive the reset go on with `appendPersistentKeys()`. See
[logging](/docs/logging#per-invocation-keys) for the split between the two.

## Types

Exported from `@lambda-event-router/base`.

| Type | Description |
| --- | --- |
| `EventTypeRouter<TEvent, TResult>` | What every router satisfies, and what the `routers` array holds |
| `LambdaRouterOptions` | Options for `new LambdaRouter` and `createLambdaRouter` |
| `LambdaMiddleware` | A global middleware function, `(event, context, next) => Promise<unknown>` |

The `LambdaRouter` class and the `createLambdaRouter` function come from the same place. `Handler` and
`Context` come from `aws-lambda`, not from this package.

### Generic parameters

`EventTypeRouter` takes two, and both default to `unknown`.

| Parameter | Types | Default |
| --- | --- | --- |
| `TEvent` | The event `handleEvent` is given | `unknown` |
| `TResult` | What `handleEvent` resolves to | `unknown` |

`routers` is typed `EventTypeRouter[]`, so it takes the bare form with both left off. You only need the
parameters when you are writing a router of your own.

## Custom routers

Anything satisfying `EventTypeRouter` can go in the `routers` array, so a service with no router of its
own is two methods rather than a fork of the library.

```ts
import type { Context } from 'aws-lambda'
import type { EventTypeRouter } from '@lambda-event-router/base'
import { isObject, LambdaRouter, logger } from '@lambda-event-router/base'

interface JobEvent {
  jobName: string
  payload: unknown
}

const jobRouter = {
  canHandleEvent: (event: unknown): boolean => isObject(event) && typeof event.jobName === 'string',

  handleEvent: async (event: JobEvent, context: Context): Promise<{ ran: string }> => {
    logger.info(`Running job ${event.jobName} for request ${context.awsRequestId}`)

    return { ran: event.jobName }
  },
} satisfies EventTypeRouter<JobEvent, { ran: string }>

const lambdaRouter = new LambdaRouter({ routers: [sqsRouter, jobRouter] })
```

`canHandleEvent` may return a promise, and narrowing the event with `isObject` from
`@lambda-event-router/base` is what keeps it honest about the `unknown` it is given.

**Recognise as little as you can get away with.** A `canHandleEvent` that returns `true` too readily
takes events a dedicated router would have handled, and the only sign is a handler receiving something
it did not expect. `EventRouter` covers a custom payload with filters and schema validation already, so
reach for a router of your own when you need the whole event source rather than one payload shape.

A router that recognises an event loosely can throw `NoRouteMatchedError`, exported from
`@lambda-event-router/base`, from `handleEvent` to hand the event back, and `LambdaRouter` tries the
next router. That is the fall-through `EventRouter` and `StepFunctionsRouter` rely on, and throwing it
is how a custom router opts in.

## Code example

An orders Lambda taking API Gateway requests, SQS messages and a scheduled report payload, with one
middleware timing all three.

Open a file: [index.ts](#lambda-example:index.ts) | [API router](#lambda-example:api.ts) | [SQS router](#lambda-example:sqs.ts) | [event router](#lambda-example:events.ts) | [middleware](#lambda-example:middleware/withTiming.ts) | [handlers](#lambda-example:handlers/orders.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { apiRouter } from './api.js'
import { eventRouter } from './events.js'
import { withTiming } from './middleware/withTiming.js'
import { sqsRouter } from './sqs.js'

// eventRouter is sorted last whatever order it is written in, so the other two get first refusal
const lambdaRouter = new LambdaRouter({
  routers: [apiRouter, sqsRouter, eventRouter],
  middleware: [withTiming],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'api.ts',
    code: `import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'

import { getOrder } from './handlers/orders.js'

export const apiRouter = createAPIGatewayRouter()

apiRouter.get({
  filters: { path: '/orders/:orderId' },
  handler: getOrder,
})`,
  },
  {
    path: 'sqs.ts',
    code: `import { createSQSRouter } from '@lambda-event-router/sqs'

import { processOrder } from './handlers/orders.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const sqsRouter = createSQSRouter({ batchItemFailures: true })

sqsRouter.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  handler: processOrder,
})`,
  },
  {
    path: 'events.ts',
    code: `import { createEventRouter, defineEventRoute, isObject, logger } from '@lambda-event-router/base'
import { z } from 'zod'

export const eventRouter = createEventRouter()

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

eventRouter.route(reportRoute)`,
  },
  {
    path: 'middleware/withTiming.ts',
    code: `import { logger, type LambdaMiddleware } from '@lambda-event-router/base'

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
    code: `import type { ApiRequest, HandlerResponse } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'
import type { SQSRequest, SQSResponse } from '@lambda-event-router/sqs'

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

Three event sources, one exported handler and one place that knows about all of them. Each router
recognises its own events, so nothing in `index.ts` inspects the event and adding a fourth source
changes nothing about the first three.

`withTiming` covers all three, because it sits above the router that ends up taking the event. See
[middleware](/docs/middleware) for the execution order and the three levels it attaches at.

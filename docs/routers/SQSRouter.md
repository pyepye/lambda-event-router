# SQSRouter

`SQSRouter` routes Amazon SQS messages to handlers, one record at a time.

A single SQS event can carry many records from the same queue. The router parses each record's body,
converts its message attributes, then works out which of your routes should handle it. Your handler
deals with one message and never sees the batch.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/sqs
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createSQSRouter } from '@lambda-event-router/sqs'
import { logInvocation } from './middleware/logInvocation'

const sqsRouter = createSQSRouter({
  batchItemFailures: true,  // Optional
  middleware: [logInvocation],  // Optional
})
```

Both options can be left out. `createSQSRouter()` on its own gives you a router that fails the whole
batch when any record throws.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `batchItemFailures` | `boolean` | No | `false` | Report failed messages back to SQS individually instead of failing the whole batch. See [Failures and retries](#failures-and-retries) |
| `middleware` | `SQSMiddleware[]` | No | `[]` | Runs for every record this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
sqsRouter.route({
  filters: {
    eventSourceArn: ORDER_QUEUE_ARN,
    messageAttributes: { Type: 'ProcessOrder' },
  },
  bodySchema: OrderSchema,  // Optional
  messageAttributesSchema: OrderAttributesSchema,  // Optional
  middleware: [withOrderContext],  // Optional
  handler: processOrder,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
sqsRouter.route(createOrderRoute).route(refundOrderRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A record that matches no route throws.** With `batchItemFailures` off that fails the entire batch,
including records that would have succeeded. Register a catch-all route filtering only on
`eventSourceArn` if you would rather swallow unknown messages, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the records you want and leave the rest off.

```ts
sqsRouter.route({
  filters: {
    eventSourceArn: [ORDER_QUEUE_ARN, ORDER_DL_QUEUE_ARN],
    messageAttributes: {
      Type: ['ProcessOrder', 'RefundOrder'],
      Region: 'eu-west-2', // Or a pattern: /^eu-/
      Attempt: 1,
    },
    custom: ({ body, record }) => {
      // Only a custom reaches the body or the raw record
      if (!isObject(body) || typeof body.total !== 'number') return false

      return body.total >= HIGH_VALUE_THRESHOLD && record.attributes.ApproximateReceiveCount === '1'
    },
  },
  handler: processOrder,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `eventSourceArn` | `FilterStringMatcher` | Matches against the record's queue ARN |
| `messageAttributes` | `Record<string, FilterStringMatcher \| number \| number[]>` | Every key listed must be present on the message and match. A missing attribute means no match |
| `custom` | `(input: SQSFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

Numeric message attributes are compared as numbers, which is why `Attempt: 1` works above. This only
applies to attributes SQS has typed as `Number`.

**`custom` sees the body before any schema has run**, so narrow it with `isObject` from
`@lambda-event-router/base` rather than reading straight into it. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { SQSRequest, SQSResponse } from '@lambda-event-router/sqs'

export async function processOrder(
  request: SQSRequest<Order, OrderAttributes>,
): Promise<SQSResponse> {
  const { orderId, total } = request.body
  logger.info(`Processing order ${orderId} for ${total}`)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `body` | `TBody` | The record body. JSON is parsed for you. If the body is not valid JSON you get the raw string |
| `messageAttributes` | `TMessageAttributes` | Message attributes converted to real values. `Number` attributes become numbers, `Binary` become a `Buffer`, everything else stays a string |
| `record` | `SQSRecord` | The untouched record from AWS, for `messageId`, `attributes` and anything else you need |
| `context` | `Context` | The Lambda context |

`SQSRecord` and `Context` come from `aws-lambda`, not from this package.

### Response type

`SQSResponse` is `undefined`. There is nothing useful to return from an SQS message, so handlers return
`Promise<SQSResponse>` and the router works out what to hand back to Lambda.

Throwing is how you signal failure. See [Failures and retries](#failures-and-retries) for what that
does to the rest of the batch.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineRoute` reads the schemas and hands your handler
a fully typed `body` and `messageAttributes`, defaults and coercion included, so `dryRun` below is a
`boolean` without you declaring that anywhere.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/sqs'
import { z } from 'zod'

const OrderSchema = z.object({ orderId: z.string(), total: z.number() })
const OrderAttributesSchema = z.object({ dryRun: z.coerce.boolean().default(false) })

export const processOrderRoute = defineRoute({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  bodySchema: OrderSchema,
  messageAttributesSchema: OrderAttributesSchema,
}).handle(async ({ body, messageAttributes }) => {
  if (messageAttributes.dryRun) return
  logger.info(`Processing order ${body.orderId} for ${body.total}`)
})

sqsRouter.route(processOrderRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`SQSRequest`](#generic-parameters) and your own types.

```ts
// handlers/processOrder.ts
import { logger } from '@lambda-event-router/base'
import type { SQSRequest, SQSResponse } from '@lambda-event-router/sqs'
import { z } from 'zod'

export const OrderSchema = z.object({ orderId: z.string(), total: z.number() })
type Order = z.infer<typeof OrderSchema>

export async function processOrder(request: SQSRequest<Order>): Promise<SQSResponse> {
  logger.info(`Processing order ${request.body.orderId}`)
}
```

```ts
// sqs.ts
import { createSQSRouter } from '@lambda-event-router/sqs'
import { OrderSchema, processOrder } from './handlers/processOrder'

const sqsRouter = createSQSRouter()

sqsRouter.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  bodySchema: OrderSchema,
  handler: processOrder,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
Typing the message attributes as well means intersecting the schema output with `SQSMessageAttributes`,
and [annotated handlers](/docs/handlers#annotated-handlers) has the worked version.

## Schema validation

Two keys take a schema, and both are optional.

```ts
const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

const OrderAttributesSchema = z.object({
  Type: z.literal('ProcessOrder'),
  dryRun: z.coerce.boolean().default(false),
})

sqsRouter.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  bodySchema: OrderSchema,
  messageAttributesSchema: OrderAttributesSchema,
  handler: processOrder,
})
```

| Key | Validates |
| --- | --- |
| `bodySchema` | The parsed record body |
| `messageAttributesSchema` | The converted message attributes |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so a record failing its schema throws rather than falling through to the next route. See
[schema validation](/docs/routing#schema-validation) for what your handler receives after coercion.

## Failures and retries

With `batchItemFailures` off, which is the default, all records in a standard queue are processed in
parallel and one throw fails the whole batch. SQS then redelivers every message in it, including the
ones that worked.

Turn it on and the router collects the failures instead, returning the message IDs Lambda needs to
redeliver just those.

```ts
const sqsRouter = createSQSRouter({ batchItemFailures: true })
```

You also need to set the `ReportBatchItemFailures` response type on the event source mapping. Without
it, AWS ignores what the router returns.

FIFO queues behave differently, and the router detects them from the `.fifo` suffix on the queue ARN.
Records are grouped by `MessageGroupId`, each group runs in order, and groups run in parallel. When a
record in a group fails, that record and every remaining record in the same group are reported as
failures so ordering survives the retry. Other groups carry on.

## Middleware

Router and route middleware are both typed `SQSMiddleware`, and the chain runs once per record, so a
batch of ten messages runs it ten times.

```ts
import { logger } from '@lambda-event-router/base'
import type { SQSMiddleware } from '@lambda-event-router/sqs'

export const logInvocation: SQSMiddleware = async (request, next) => {
  logger.info(`Handling message ${request.record.messageId}`)
  return next(request)
}
```

```ts
const sqsRouter = createSQSRouter({ middleware: [logInvocation] })

sqsRouter.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  middleware: [withOrderContext],
  handler: processOrder,
})
```

Records in a batch run in parallel, so pass per-record values on each log call rather than reaching for
`appendKeys`. See [middleware](/docs/middleware) for the execution order and the three levels it
attaches at.

## Types

All exported from `@lambda-event-router/sqs`.

| Type | Description |
| --- | --- |
| `SQSRequest<TBody, TMessageAttributes>` | The handler argument |
| `SQSResponse` | Handler return type, `undefined` |
| `SQSFilters` | The `filters` object |
| `SQSFilterInput` | What `custom` receives |
| `SQSRecordHandler<TBody, TMessageAttributes>` | The `handler` function |
| `SQSRouteDefinition<TBody, TMessageAttributes>` | A full route passed to `route()` |
| `SQSRouterOptions` | Options for `createSQSRouter` |
| `SQSMiddleware<TBody, TMessageAttributes>` | Router and route middleware |
| `SQSMessageAttributes` | `Record<string, SQSMessageAttributeValue>` |
| `SQSMessageAttributeValue` | `string \| number \| Buffer` |

The `SQSRouter` class and the `createSQSRouter` and `defineRoute` functions come from the same place.

### Generic parameters

The three types above that take parameters take the same two, in the same order.

| Parameter | Types | Default |
| --- | --- | --- |
| `TBody` | `request.body` | `unknown` |
| `TMessageAttributes` | `request.messageAttributes` | `SQSMessageAttributes` |

Pass just the first and the second falls back to its default, so `SQSRequest<Order>` types the body and
leaves message attributes loose. `TMessageAttributes` has to extend `SQSMessageAttributes`, so its
values can only be a string, a number or a `Buffer`.

You only need these for [annotated handlers](#annotated-handlers). Inference covers both.

## Code example

An order queue and a dead letter queue feeding one Lambda, with high value orders going to their own
handler.

Open a file: [index.ts](#sqs-example:index.ts) | [SQS router](#sqs-example:sqs.ts) | [handlers](#sqs-example:handlers/orders.ts) | [schema](#sqs-example:schemas/order.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { sqsRouter } from './sqs.js'

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'sqs.ts',
    code: `import { createSQSRouter } from '@lambda-event-router/sqs'

import { processOrder, refundOrder } from './handlers/orders.js'
import { OrderSchema } from './schemas/order.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'
const ORDER_DL_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders-dl'

export const sqsRouter = createSQSRouter({ batchItemFailures: true })

sqsRouter
  .route({
    filters: {
      eventSourceArn: [ORDER_QUEUE_ARN, ORDER_DL_QUEUE_ARN],
      messageAttributes: { Type: 'ProcessOrder' },
    },
    bodySchema: OrderSchema,
    handler: processOrder,
  })
  .route({
    filters: {
      eventSourceArn: [ORDER_QUEUE_ARN, ORDER_DL_QUEUE_ARN],
      messageAttributes: { Type: 'RefundOrder' },
    },
    bodySchema: OrderSchema,
    handler: refundOrder,
  })`,
  },
  {
    path: 'handlers/orders.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { SQSRequest, SQSResponse } from '@lambda-event-router/sqs'

import type { Order } from '../schemas/order.js'

export async function processOrder(request: SQSRequest<Order>): Promise<SQSResponse> {
  logger.info(\`Processing order \${request.body.orderId}\`)
}

export async function refundOrder(request: SQSRequest<Order>): Promise<SQSResponse> {
  logger.info(\`Refunding order \${request.body.orderId} for \${request.body.total}\`)
}`,
  },
  {
    path: 'schemas/order.ts',
    code: `import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

export type Order = z.infer<typeof OrderSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="sqs-example" default-file="sqs.ts" line-numbers collapse-toggle fixed-height />

Each route matches a different `Type` attribute, so no message can match both and the order you
register them in makes no difference. Both accept the dead letter queue as well as the main one, so a
redriven message lands on the same handler it would have the first time.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.


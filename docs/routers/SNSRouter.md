# SNSRouter

`SNSRouter` routes Amazon SNS notifications to handlers, one record at a time.

The router parses each record's message, converts its message attributes, then works out which of your
routes should handle it. You can route on the topic, the subject or any message attribute.

## Install

```bash
npm install @lambda-event-router/sns
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

## Create the router

```ts
import { createSNSRouter } from '@lambda-event-router/sns'
import { logInvocation } from './middleware/logInvocation'

const snsRouter = createSNSRouter({
  batchItemFailures: false,  // Optional
  middleware: [logInvocation],  // Optional
})
```

Both options can be left out. `createSNSRouter()` on its own is what you want most of the time.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `batchItemFailures` | `boolean` | No | `false` | Swallow record errors instead of failing the invocation. Read [Failures and retries](#failures-and-retries) before turning this on |
| `middleware` | `SNSMiddleware[]` | No | `[]` | Runs for every record this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
snsRouter.route({
  filters: {
    topicArn: ORDER_TOPIC_ARN,
    subject: 'Order created',
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
snsRouter.route(createOrderRoute).route(refundOrderRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A record that matches no route throws.** That fails the invocation, which is usually what you want,
since it lets the subscription retry. With `batchItemFailures` on it is swallowed instead. [Nothing
matched](/docs/routing#nothing-matched) covers what the other routers do.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the records you want and leave the rest off.

```ts
snsRouter.route({
  filters: {
    topicArn: [ORDER_TOPIC_ARN, ORDER_DL_TOPIC_ARN],
    subject: 'Order created', // Or a pattern: /^Order /
    messageAttributes: {
      Type: ['OrderCreated', 'OrderRefunded'],
      Region: 'eu-west-2', // Or a pattern: /^eu-/
      Attempt: 1,
    },
    custom: ({ body }) => {
      // Only a custom reaches the parsed body
      if (!isObject(body) || typeof body.total !== 'number') return false

      return body.total >= HIGH_VALUE_THRESHOLD
    },
  },
  handler: processOrder,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `topicArn` | `FilterStringMatcher` | Matches against the record's topic ARN |
| `subject` | `FilterStringMatcher` | Matches against the notification subject |
| `messageAttributes` | `Record<string, FilterStringMatcher \| number \| number[]>` | Every key listed must be present on the message and match. A missing attribute means no match |
| `custom` | `(input: SNSFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**A subject filter never matches a notification published without one.** `Subject` is optional in
SNS, and plenty of publishers leave it unset. If some of your messages have no subject, route those on
`topicArn` or a message attribute instead.

**`custom` sees the body before any schema has run**, so narrow it with `isObject` from
`@lambda-event-router/base` rather than reading straight into it. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { SNSRequest, SNSResponse } from '@lambda-event-router/sns'

export async function processOrder(
  request: SNSRequest<Order, OrderAttributes>,
): Promise<SNSResponse> {
  const { orderId, total } = request.body
  logger.info(`Processing order ${orderId} for ${total}`)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `body` | `TBody` | The notification message. JSON is parsed for you. If the message is not valid JSON you get the raw string |
| `messageAttributes` | `TMessageAttributes` | Message attributes converted to real values. See [Message attribute types](#message-attribute-types) |
| `record` | `SNSEventRecord` | The untouched record from AWS, for `Sns.MessageId`, `Sns.Timestamp` and anything else you need |
| `context` | `Context` | The Lambda context |

`SNSEventRecord` and `Context` come from `aws-lambda`, not from this package.

### Message attribute types

SNS types its attributes and the router converts them for you rather than handing you raw strings.

| SNS type | You get | Notes |
| --- | --- | --- |
| `String` | `string` | |
| `Number` | `number` | |
| `Binary` | `Buffer` | Decoded from base64 |
| `String.Array` | `Array<string \| number \| boolean \| null>` | Parsed from the JSON SNS stores it as |

**A malformed `String.Array` attribute throws before your handler runs.** The value has to parse as a
JSON array of strings, numbers, booleans or nulls. Anything else fails the record.

### Response type

`SNSResponse` is `undefined`. There is nothing useful to return from a notification, so handlers return
`Promise<SNSResponse>`.

Throwing is how you signal failure. See [Failures and retries](#failures-and-retries) for what that
does to the invocation.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineRoute` reads the schemas and hands your handler
a fully typed `body` and `messageAttributes`, defaults and coercion included, so `dryRun` below is a
`boolean` without you declaring that anywhere.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/sns'
import { z } from 'zod'

const OrderSchema = z.object({ orderId: z.string(), total: z.number() })
const OrderAttributesSchema = z.object({ dryRun: z.coerce.boolean().default(false) })

export const processOrderRoute = defineRoute({
  filters: { topicArn: ORDER_TOPIC_ARN },
  bodySchema: OrderSchema,
  messageAttributesSchema: OrderAttributesSchema,
}).handle(async ({ body, messageAttributes }) => {
  if (messageAttributes.dryRun) return
  logger.info(`Processing order ${body.orderId} for ${body.total}`)
})

snsRouter.route(processOrderRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`SNSRequest`](#generic-parameters) and your own types.

```ts
// handlers/processOrder.ts
import { logger } from '@lambda-event-router/base'
import type { SNSRequest, SNSResponse } from '@lambda-event-router/sns'
import { z } from 'zod'

export const OrderSchema = z.object({ orderId: z.string(), total: z.number() })
type Order = z.infer<typeof OrderSchema>

export async function processOrder(request: SNSRequest<Order>): Promise<SNSResponse> {
  logger.info(`Processing order ${request.body.orderId}`)
}
```

```ts
// sns.ts
import { createSNSRouter } from '@lambda-event-router/sns'
import { OrderSchema, processOrder } from './handlers/processOrder'

const snsRouter = createSNSRouter()

snsRouter.route({
  filters: { topicArn: ORDER_TOPIC_ARN },
  bodySchema: OrderSchema,
  handler: processOrder,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
Typing the message attributes as well means intersecting the schema output with `SNSMessageAttributes`,
which [annotated handlers](/docs/handlers#annotated-handlers) shows for SQS.

## Schema validation

Two keys take a schema, and both are optional.

```ts
const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

const OrderAttributesSchema = z.object({
  Type: z.literal('OrderCreated'),
  dryRun: z.coerce.boolean().default(false),
})

snsRouter.route({
  filters: { topicArn: ORDER_TOPIC_ARN },
  bodySchema: OrderSchema,
  messageAttributesSchema: OrderAttributesSchema,
  handler: processOrder,
})
```

| Key | Validates |
| --- | --- |
| `bodySchema` | The parsed notification message |
| `messageAttributesSchema` | The converted message attributes |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so a record failing its schema throws rather than falling through to the next route. See
[schema validation](/docs/routing#schema-validation) for what your handler receives after coercion.

## Failures and retries

By default the router processes every record and lets the first error through, so the invocation fails
and you get retries plus, if the subscription has one, a dead letter queue.

**`batchItemFailures` does not report failures for SNS.** There is no partial batch response for an
SNS subscription, so with the option on the router runs every record, discards the outcomes and returns
nothing. A handler that throws, a record matching no route and a record failing schema validation all
leave the invocation looking successful.

```ts
// Errors from here on are swallowed, not reported
const snsRouter = createSNSRouter({ batchItemFailures: true })
```

Leave it off unless your handlers do their own error handling and you genuinely want a failure to stop
there. If you want per-record retries, subscribe an SQS queue to the topic and use
[SQSRouter](/routers/SQSRouter), which does report individual failures.

## Middleware

Router and route middleware are both typed `SNSMiddleware`, and the chain runs once per record
alongside your handler rather than once per invocation.

```ts
import { logger } from '@lambda-event-router/base'
import type { SNSMiddleware } from '@lambda-event-router/sns'

export const logInvocation: SNSMiddleware = async (request, next) => {
  logger.info(`Handling notification ${request.record.Sns.MessageId}`)
  return next(request)
}
```

```ts
const snsRouter = createSNSRouter({ middleware: [logInvocation] })

snsRouter.route({
  filters: { topicArn: ORDER_TOPIC_ARN },
  middleware: [withOrderContext],
  handler: processOrder,
})
```

Where an event does carry several records they run in parallel, so pass per-record values on each log
call rather than reaching for `appendKeys`. See [middleware](/docs/middleware) for the execution order
and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/sns`.

| Type | Description |
| --- | --- |
| `SNSRequest<TBody, TMessageAttributes>` | The handler argument |
| `SNSResponse` | Handler return type, `undefined` |
| `SNSFilters` | The `filters` object |
| `SNSFilterInput` | What `custom` receives |
| `SNSRecordHandler<TBody, TMessageAttributes>` | The `handler` function |
| `SNSRouteDefinition<TBody, TMessageAttributes>` | A full route passed to `route()` |
| `SNSRouterOptions` | Options for `createSNSRouter` |
| `SNSMiddleware<TBody, TMessageAttributes>` | Router and route middleware |
| `SNSMessageAttributes` | `Record<string, SNSMessageAttributeValue>` |
| `SNSMessageAttributeValue` | `string \| number \| Buffer \| SNSStringArrayItem[]` |
| `SNSStringArrayItem` | `string \| number \| boolean \| null`, the members of a `String.Array` |
| `SNSRawMessageAttributes` | The attributes as AWS sends them, before conversion |

The `SNSRouter` class and the `createSNSRouter` and `defineRoute` functions come from the same place.

### Generic parameters

The three types above that take parameters take the same two, in the same order.

| Parameter | Types | Default |
| --- | --- | --- |
| `TBody` | `request.body` | `unknown` |
| `TMessageAttributes` | `request.messageAttributes` | `SNSMessageAttributes` |

Pass just the first and the second falls back to its default, so `SNSRequest<Order>` types the body and
leaves message attributes loose. `TMessageAttributes` has to extend `SNSMessageAttributes`.

You only need these for [annotated handlers](#annotated-handlers). Inference covers both.

## Code example

One topic carrying order events, with created and refunded notifications going to their own handlers.

Open a file: [index.ts](#sns-example:index.ts) | [SNS router](#sns-example:sns.ts) | [handlers](#sns-example:handlers/orders.ts) | [schema](#sns-example:schemas/order.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { snsRouter } from './sns.js'

const lambdaRouter = new LambdaRouter({
  routers: [snsRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'sns.ts',
    code: `import { createSNSRouter } from '@lambda-event-router/sns'

import { processOrder, refundOrder } from './handlers/orders.js'
import { OrderSchema } from './schemas/order.js'

const ORDER_TOPIC_ARN = 'arn:aws:sns:eu-west-2:123456789012:orders'

export const snsRouter = createSNSRouter()

snsRouter
  .route({
    filters: {
      topicArn: ORDER_TOPIC_ARN,
      subject: 'Order created',
    },
    bodySchema: OrderSchema,
    handler: processOrder,
  })
  .route({
    filters: {
      topicArn: ORDER_TOPIC_ARN,
      subject: 'Order refunded',
    },
    bodySchema: OrderSchema,
    handler: refundOrder,
  })`,
  },
  {
    path: 'handlers/orders.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { SNSRequest, SNSResponse } from '@lambda-event-router/sns'

import type { Order } from '../schemas/order.js'

export async function processOrder(request: SNSRequest<Order>): Promise<SNSResponse> {
  logger.info(\`Processing order \${request.body.orderId}\`)
}

export async function refundOrder(request: SNSRequest<Order>): Promise<SNSResponse> {
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

<CodeFileViewer :files="files" id="sns-example" default-file="sns.ts" line-numbers collapse-toggle fixed-height />

Each route matches a different subject, so no notification can match both and the order you register
them in makes no difference. Both routes need the publisher to set a subject, so if that is not
guaranteed, filter on a message attribute instead.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

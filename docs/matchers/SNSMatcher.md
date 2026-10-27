# SNSMatcher

`SNSMatcher` routes Amazon SNS notifications to handlers, one record at a time.

The matcher parses each record's message, converts its message attributes, then works out which of your
routes should handle it. You can route on the topic, the subject or any message attribute.

## Install

```bash
npm install @latcher/base @latcher/sns
```

`@latcher/base` is a peer dependency, so install it yourself. It exports
`Latcher`, which every matcher plugs into.

## Create the matcher

```ts
import { createSNSMatcher } from '@latcher/sns'
import { logInvocation } from './middleware/logInvocation'

const snsMatcher = createSNSMatcher({
  middleware: [logInvocation],  // Optional
})
```

The option can be left out. `createSNSMatcher()` on its own is what you want most of the time.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `SNSMiddleware[]` | No | `[]` | Runs for every record this matcher handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
snsMatcher.route({
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

`route()` returns the matcher, so you can chain registrations.

```ts
snsMatcher.route(createOrderRoute).route(refundOrderRoute)
```

Routes are ranked by how specific they are. Where two overlap, the one matching only a subset of the
other is tried first, whatever order you registered them in. Registration order decides the rest, so give
each route filters no other route can match. See [match order](/docs/routing#match-order) for how ranking
works and what it cannot settle.

**A record that matches no route throws.** That fails the invocation, which is usually what you want,
since it lets Lambda retry the notification. [Nothing matched](/docs/routing#nothing-matched) covers
what the other matchers do.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the records you want and leave the rest off.

```ts
snsMatcher.route({
  filters: {
    topicArn: [ORDER_TOPIC_ARN, ORDER_DL_TOPIC_ARN],
    subject: 'Order created', // Or a pattern: /^Order /
    messageAttributes: {
      Type: ['OrderCreated', 'OrderRefunded'],
      Region: 'eu-west-2', // Or a pattern: /^eu-/
      Attempt: '1', // Always a string, whatever it was published as
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
| `messageAttributes` | `Record<string, FilterStringMatcher>` | Every key listed must be present on the message and match. A missing attribute means no match |
| `custom` | `(input: SNSFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**A `Binary` attribute never matches a `messageAttributes` filter.** It arrives as a `Buffer`, and no
matcher describes one. Pick those out with a `custom` filter instead.

**Every other attribute is a string when it reaches a filter**, so match `'1'` rather than `1`. See
[Message attribute types](#message-attribute-types) for why.

**A subject filter never matches a notification published without one.** `Subject` is optional in
SNS, and plenty of publishers leave it unset. If some of your messages have no subject, route those on
`topicArn` or a message attribute instead.

**`custom` sees the body before any schema has run**, so narrow it with `isObject` from
`@latcher/base` rather than reading straight into it. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@latcher/base'
import type { SNSRequest, SNSResponse } from '@latcher/sns'

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

`Publish` takes four attribute types, but a Lambda subscription receives two. SNS flattens `Number`
and `String.Array` to `String` on the way.

| You publish | Your handler gets |
| --- | --- |
| `String` | `'OrderPlaced'` |
| `Number` | `'2'`, a string |
| `String.Array` | `'["london","manchester"]'`, a string holding the JSON |
| `Binary` | a `Buffer`, decoded from base64 |

A custom label on a published type, such as `Number.float` or `Binary.gif`, does not reach your
handler: SNS drops it and delivers the base type. [`SQSMatcher`](/matchers/SQSMatcher) behaves the other
way round, so a route moved from one to the other cannot filter on a label.

Only `Binary` is converted for you. Handle the other two in your schema:

```ts
priority: z.coerce.number(), // '2' becomes 2
warehouses: z.string().transform((value) => JSON.parse(value)),
```

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
import { logger } from '@latcher/base'
import { defineRoute } from '@latcher/sns'
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

snsMatcher.route(processOrderRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`SNSRequest`](#generic-parameters) and your own types.

```ts
// handlers/processOrder.ts
import { logger } from '@latcher/base'
import type { SNSRequest, SNSResponse } from '@latcher/sns'
import { z } from 'zod'

export const OrderSchema = z.object({ orderId: z.string(), total: z.number() })
type Order = z.infer<typeof OrderSchema>

export async function processOrder(request: SNSRequest<Order>): Promise<SNSResponse> {
  logger.info(`Processing order ${request.body.orderId}`)
}
```

```ts
// sns.ts
import { createSNSMatcher } from '@latcher/sns'
import { OrderSchema, processOrder } from './handlers/processOrder'

const snsMatcher = createSNSMatcher()

snsMatcher.route({
  filters: { topicArn: ORDER_TOPIC_ARN },
  bodySchema: OrderSchema,
  handler: processOrder,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
To type the message attributes as well, pass `z.infer` of the attribute schema as the second
parameter. [Annotated handlers](/docs/handlers#annotated-handlers) shows this for SQS.

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

snsMatcher.route({
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

The matcher lets the first error through, so the invocation fails. A handler that throws, a record
matching no route and a record failing schema validation all fail it the same way.

**There is no partial batch response for an SNS subscription**, so the matcher has nowhere to report one
record's failure. Failing the invocation is what lets Lambda retry it and then reach the function's
on-failure destination, so there is no option to turn that off.

If you want per-record retries across a batch, subscribe an SQS queue to the topic and use
[SQSMatcher](/matchers/SQSMatcher), which does report individual failures.

## Middleware

Matcher and route middleware are both typed `SNSMiddleware`, and the chain runs once per record
alongside your handler rather than once per invocation.

```ts
import { logger } from '@latcher/base'
import type { SNSMiddleware } from '@latcher/sns'

export const logInvocation: SNSMiddleware = async (request, next) => {
  logger.info(`Handling notification ${request.record.Sns.MessageId}`)
  return next(request)
}
```

```ts
const snsMatcher = createSNSMatcher({ middleware: [logInvocation] })

snsMatcher.route({
  filters: { topicArn: ORDER_TOPIC_ARN },
  middleware: [withOrderContext],
  handler: processOrder,
})
```

A route middleware can name the route's own types, so `SNSMiddleware<Order, OrderAttributes>` reads
`request.body` as an `Order`. Name both parameters even if you only touch the body, because `next`
makes the type invariant.

Where an event does carry several records they run in parallel, so pass per-record values on each log
call rather than reaching for `appendKeys`. See [middleware](/docs/middleware) for the execution order
and the three levels it attaches at.

## Types

All exported from `@latcher/sns`.

| Type | Description |
| --- | --- |
| `SNSRequest<TBody, TMessageAttributes>` | The handler argument |
| `SNSResponse` | Handler return type, `undefined` |
| `SNSFilters` | The `filters` object |
| `SNSFilterInput` | What `custom` receives |
| `SNSRecordHandler<TBody, TMessageAttributes>` | The `handler` function |
| `SNSRouteDefinition<TBody, TMessageAttributes>` | A full route passed to `route()` |
| `SNSMatcherOptions` | Options for `createSNSMatcher` |
| `SNSMiddleware<TBody, TMessageAttributes>` | Matcher and route middleware |
| `SNSMessageAttributes` | `Record<string, SNSMessageAttributeValue>` |
| `SNSMessageAttributeValue` | `string \| Buffer` |
| `SNSRawMessageAttributes` | The attributes as AWS sends them, before conversion |

The `SNSMatcher` class and the `createSNSMatcher` and `defineRoute` functions come from the same place.

### Generic parameters

The three types above that take parameters take the same two, in the same order.

| Parameter | Types | Default |
| --- | --- | --- |
| `TBody` | `request.body` | `unknown` |
| `TMessageAttributes` | `request.messageAttributes` | `SNSMessageAttributes` |

Pass just the first and the second falls back to its default, so `SNSRequest<Order>` types the body and
leaves message attributes loose.

You only need these for [annotated handlers](#annotated-handlers). Inference covers both.

## Code example

One topic carrying order events, with created and refunded notifications going to their own handlers.

Open a file: [index.ts](#sns-example:index.ts) | [SNS matcher](#sns-example:sns.ts) | [handlers](#sns-example:handlers/orders.ts) | [schema](#sns-example:schemas/order.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { snsMatcher } from './sns.js'

const latcher = new Latcher({
  matchers: [snsMatcher],
})

export const handler: Handler = latcher.handler()`,
  },
  {
    path: 'sns.ts',
    code: `import { createSNSMatcher } from '@latcher/sns'

import { processOrder, refundOrder } from './handlers/orders.js'
import { OrderSchema } from './schemas/order.js'

const ORDER_TOPIC_ARN = 'arn:aws:sns:eu-west-2:123456789012:orders'

export const snsMatcher = createSNSMatcher()

snsMatcher
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
    code: `import { logger } from '@latcher/base'
import type { SNSRequest, SNSResponse } from '@latcher/sns'

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

`index.ts` hands the matcher to `Latcher`, which is what AWS invokes and what every matcher in the
Lambda gets registered on. See [matchers](/docs/matchers) for how the two levels of matching fit
together.

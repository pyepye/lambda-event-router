# ActiveMQRouter

`ActiveMQRouter` routes Amazon MQ for ActiveMQ messages to handlers, one message at a time.

An event carries a list of messages from one broker, and every message body arrives base64 encoded. A
text message is decoded to text and parsed as JSON; a bytes message is decoded to a `Buffer` of the raw
bytes. The router works out which of your routes should handle each one, and your handler deals with a
single message and never sees the batch.

Every message is either a text message or a bytes message, and a route can take one type or both.

## Install

```bash
npm install @lambda-event-router/mq
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

The package holds `RabbitMQRouter` as well, so the functions are named per router. You want
`createActiveMQRouter` and `defineActiveMQRoute` rather than the `createRouter` and `defineRoute` a
single router package gives you.

## Create the router

```ts
import { createActiveMQRouter } from '@lambda-event-router/mq'
import { logInvocation } from './middleware/logInvocation'

const activeMQRouter = createActiveMQRouter({
  middleware: [logInvocation],  // Optional
})
```

The one option can be left out, so `createActiveMQRouter()` is what you want most of the time.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `ActiveMQMiddleware[]` | No | `[]` | Runs for every message this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
activeMQRouter.route({
  filters: {
    destination: 'orders',
    messageType: 'jms/text-message',
  },
  bodySchema: OrderSchema,  // Optional
  middleware: [withOrderContext],  // Optional
  handler: processOrder,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
activeMQRouter.route(processOrderRoute).route(refundOrderRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A message that matches no route throws**, which fails the invocation and leaves the messages behind
it in the batch unhandled. Register a catch-all route with empty `filters` if you would rather swallow
unknown messages, and see [nothing matched](/docs/routing#nothing-matched) for what the other routers
do instead.

### Convenience methods

`textMessage()` and `bytesMessage()` are `route()` with the `messageType` filter already set.

```ts
activeMQRouter.textMessage({
  filters: { destination: 'orders' },
  handler: processOrder,
})

// The same route written out
activeMQRouter.route({
  filters: { destination: 'orders', messageType: 'jms/text-message' },
  handler: processOrder,
})
```

| Method | Sets | Handler is given |
| --- | --- | --- |
| `textMessage()` | `messageType: 'jms/text-message'` | `ActiveMQTextMessageRequest` |
| `bytesMessage()` | `messageType: 'jms/bytes-message'` | `ActiveMQBytesMessageRequest` |

Both take `middleware` and return the router so they chain, and `textMessage()` takes `bodySchema` too.
A bytes body is a `Buffer` with no JSON to validate, so `bytesMessage()` has no `bodySchema`. What they
both drop is `messageType` itself: it is gone from the filters they accept, so setting it is a type
error rather than a value that silently loses to the one the method sets.

See [convenience methods](/docs/routing#convenience-methods) for how the other routers use them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the messages you want and leave the rest off.

```ts
activeMQRouter.route({
  filters: {
    eventSourceArn: BROKER_ARN,
    messageType: 'jms/text-message',
    destination: ['orders', 'priority-orders'], // Or a pattern: /^priority-/
    custom: ({ record }) => {
      // Only a custom reaches the message itself
      return record.priority >= HIGH_PRIORITY
    },
  },
  handler: processOrder,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `eventSourceArn` | `FilterStringMatcher` | Matches the ARN of the broker the event came from |
| `messageType` | `ActiveMQMessageType \| ActiveMQMessageType[]` | Matches the type of the message. See [Message types](#message-types) |
| `destination` | `FilterStringMatcher` | Matches `destination.physicalName`, which is the queue or topic name on the broker |
| `custom` | `(input: ActiveMQFilterInput) => boolean \| Promise<boolean>` | Anything the other keys cannot express, given the `messageType`, the `destination`, the decoded `message` and the raw `record`. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**`messageType` is compared exactly.** It is the one filter that takes no wildcard and no `RegExp`, and
it accepts only the two `ActiveMQMessageType` values, so a misspelled one is a compile error rather than
a filter that quietly matches nothing.

`custom` is the only key that reaches the message itself, so the JMS properties in
`record.properties`, the priority and `redelivered` are all filterable through it and nowhere else.

**`custom` gets no parsed body.** Schema validation runs after a route matches, so parse `message.data`
yourself to route on the contents. The filter sees the same split as the handler: on a text message
`message.data` is decoded text and `record.data` is the base64 AWS sent, and on a bytes message both
stay base64. See [`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { ActiveMQResponse, ActiveMQTextMessageRequest } from '@lambda-event-router/mq'

export async function processOrder(
  request: ActiveMQTextMessageRequest<Order>,
): Promise<ActiveMQResponse> {
  const { orderId, total } = request.body
  logger.info(`Processing order ${orderId} for ${total} from ${request.destination}`)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `message` | `ActiveMQMessage` | The message. On a text message `data` is decoded to text; on a bytes message `data` is the base64 AWS sent |
| `destination` | `string` | The queue or topic the message came from, taken from `destination.physicalName` |
| `body` | `TBody` on text, `Buffer` on bytes | A text body is the decoded data parsed as JSON, or the raw string if it is not JSON. A bytes body is a `Buffer` of the raw bytes |
| `messageType` | `ActiveMQMessageType` | Which of the two types this message is. See [Message types](#message-types) |
| `record` | `ActiveMQMessage` | The untouched message from AWS, so `data` is still base64 |
| `context` | `Context` | The Lambda context |

`ActiveMQMessage` and `ActiveMQDestination` are declared by this package, since `aws-lambda` carries no
ActiveMQ types. `Context` does come from `aws-lambda`.

**On a text message, `message` and `record` differ by one field.** `message.data` is the decoded text
and `record.data` is the base64 AWS sent. On a bytes message the two are identical, since the router
leaves `data` base64 and hands the decoded bytes to `body` instead. `messageID`, `properties` and the
rest are the same on both.

### Response type

`ActiveMQResponse` is `undefined`. There is nothing useful to return to a broker, so handlers return
`Promise<ActiveMQResponse>` and the router works out what to hand back to Lambda.

Throwing is how you signal failure. See [Failures and retries](#failures-and-retries) for what that
does to the rest of the batch.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineActiveMQRoute` reads the schema and hands your
handler a fully typed `body`, defaults and coercion included, so `total` below is a `number` without
you declaring that anywhere.

```ts
import { logger } from '@lambda-event-router/base'
import { defineActiveMQRoute } from '@lambda-event-router/mq'
import { z } from 'zod'

const OrderSchema = z.object({ orderId: z.string(), total: z.coerce.number() })

export const processOrderRoute = defineActiveMQRoute({
  filters: { destination: 'orders', messageType: 'jms/text-message' },
  bodySchema: OrderSchema,
}).handle(async ({ body, destination }) => {
  logger.info(`Processing order ${body.orderId} for ${body.total} from ${destination}`)
})

activeMQRouter.route(processOrderRoute)
```

It reads the `messageType` filter as well, so the request above is the text message one rather than the
union. [Message types](#message-types) covers when that narrowing happens.

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`ActiveMQTextMessageRequest`](#generic-parameters) and your own types.

```ts
// handlers/processOrder.ts
import { logger } from '@lambda-event-router/base'
import type { ActiveMQResponse, ActiveMQTextMessageRequest } from '@lambda-event-router/mq'
import { z } from 'zod'

export const OrderSchema = z.object({ orderId: z.string(), total: z.number() })
type Order = z.infer<typeof OrderSchema>

export async function processOrder(
  request: ActiveMQTextMessageRequest<Order>,
): Promise<ActiveMQResponse> {
  logger.info(`Processing order ${request.body.orderId}`)
}
```

```ts
// activemq.ts
import { createActiveMQRouter } from '@lambda-event-router/mq'
import { OrderSchema, processOrder } from './handlers/processOrder'

const activeMQRouter = createActiveMQRouter()

activeMQRouter.textMessage({
  filters: { destination: 'orders' },
  bodySchema: OrderSchema,
  handler: processOrder,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
The `textMessage()` call is doing real work here, since naming one of the two request types in the
handler does not filter for it, and [annotated handlers](/docs/handlers#annotated-handlers) has the
worked version.

## Message types

Amazon MQ tags every message as one of two types, and `request.messageType` carries which.

| Type | What it is |
| --- | --- |
| `jms/text-message` | A JMS `TextMessage`, so `data` is text the sender wrote |
| `jms/bytes-message` | A JMS `BytesMessage`, so `data` is whatever bytes the sender wrote |

`ActiveMQRequest` is the union of `ActiveMQTextMessageRequest` and `ActiveMQBytesMessageRequest`, and
`messageType` is what tells them apart. Pin one type on the route and the request narrows to it.

```ts
activeMQRouter.textMessage({
  filters: { destination: 'orders' },
  handler: async (request) => {
    // request is ActiveMQTextMessageRequest
  },
})

const scanRoute = defineActiveMQRoute({
  filters: { messageType: 'jms/bytes-message' },
}).handle(async (request) => {
  // request is ActiveMQBytesMessageRequest
})
```

A route naming both types, or leaving `messageType` off, gets the union and has to check
`request.messageType` before doing anything specific to one of them.

**A narrowed handler needs a matching `messageType` filter.** `route()` types the handler from the
`messageType` filter, so a handler annotated `ActiveMQTextMessageRequest` compiles only on a route that
filters for `jms/text-message`, whether through the filter directly or `textMessage()`. A route with no
`messageType` filter types the handler as the union, so it cannot be annotated to one type and then
handed the other at runtime.

**A bytes message body is a `Buffer`.** The router decodes base64 to text and parses JSON only for a
text message. A bytes message is decoded straight to a `Buffer` of the raw bytes on `request.body`, so
binary that is not UTF-8 arrives intact rather than mangled. `message.data` and `record.data` stay the
base64 AWS sent.

## Schema validation

One key takes a schema, and it is optional.

```ts
const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

activeMQRouter.textMessage({
  filters: { destination: 'orders' },
  bodySchema: OrderSchema,
  handler: processOrder,
})
```

| Key | Validates |
| --- | --- |
| `bodySchema` | The decoded message data, parsed as JSON |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so a message failing its schema throws rather than falling through to the next route. See
[schema validation](/docs/routing#schema-validation) for what your handler receives after coercion.

**`bodySchema` validates a text body only.** A bytes body is a `Buffer`, so it skips JSON parsing and
schema validation, and `bytesMessage()` and a `jms/bytes-message` route built with `defineActiveMQRoute`
both reject a `bodySchema` at compile time. On a text route, data that is not JSON reaches the schema as
a string and a `z.object()` rejects it, so keep `bodySchema` on the text routes carrying JSON.

## Failures and retries

A handler that throws fails the invocation. Messages are handled one at a time, in the order the event
lists them, so a throw stops everything behind it in the batch from running.

The router has no way to report single messages back to Lambda, so a failure applies to all of them.
None are acknowledged, the broker redelivers the whole batch, and the messages that already succeeded
run a second time. Make handlers safe to run twice and read `message.redelivered` where a repeat costs
something.

The batch size on the event source mapping decides how much gets replayed, so a smaller batch means
less repeated work after a failure.

A message matching no route throws the same way, naming the `messageID` it could not place.

## Middleware

Router and route middleware are both typed `ActiveMQMiddleware`, and the chain runs once per message,
so a batch of ten messages runs it ten times.

```ts
import { logger } from '@lambda-event-router/base'
import type { ActiveMQMiddleware } from '@lambda-event-router/mq'

export const logInvocation: ActiveMQMiddleware = async (request, next) => {
  logger.info(`Handling ${request.message.messageID} from ${request.destination}`)
  return next(request)
}
```

```ts
const activeMQRouter = createActiveMQRouter({ middleware: [logInvocation] })

activeMQRouter.textMessage({
  filters: { destination: 'orders' },
  middleware: [withOrderContext],
  handler: processOrder,
})
```

`ActiveMQMiddleware` takes no type parameters, so middleware always sees the union request with an
`unknown` body, however the route it is attached to is typed. See [middleware](/docs/middleware) for
the execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/mq`.

| Type | Description |
| --- | --- |
| `ActiveMQRequest<TBody>` | The handler argument, the union of the two below |
| `ActiveMQTextMessageRequest<TBody>` | The handler argument on a text message route |
| `ActiveMQBytesMessageRequest` | The handler argument on a bytes message route, its `body` a `Buffer` |
| `ActiveMQResponse` | Handler return type, `undefined` |
| `ActiveMQMessageType` | `'jms/text-message' \| 'jms/bytes-message'` |
| `ActiveMQFilters` | The `filters` object |
| `ActiveMQFilterInput` | What `custom` receives |
| `ActiveMQRouteDefinition<TBody>` | A full route passed to `route()` |
| `ActiveMQTextMessageRouteDefinition<TBody>` | A route passed to `textMessage()`, with no `messageType` filter |
| `ActiveMQBytesMessageRouteDefinition` | A route passed to `bytesMessage()`, with no `messageType` filter and no `bodySchema` |
| `ActiveMQRouterOptions` | Options for `createActiveMQRouter` |
| `ActiveMQMiddleware` | Router and route middleware |
| `ActiveMQMessage` | One message, as `request.message` and `request.record` |
| `ActiveMQDestination` | The `destination` on a message, holding `physicalName` |
| `ActiveMQEvent` | The whole event, with its messages in one array |

The `ActiveMQRouter` class and the `createActiveMQRouter` and `defineActiveMQRoute` functions come from
the same place.

### Generic parameters

The types above that take a parameter all take the same one.

| Parameter | Types | Default |
| --- | --- | --- |
| `TBody` | `request.body` | `unknown` |

Leave it off and the body is `unknown`, which is what `ActiveMQMiddleware` and `ActiveMQFilterInput`
see however the route is typed. You only need it for [annotated handlers](#annotated-handlers), since
inference covers the rest.

## Code example

Orders arriving as text and scanned documents arriving as bytes, on one broker, with anything else
logged and dropped.

Open a file: [index.ts](#activemq-example:index.ts) | [ActiveMQ router](#activemq-example:activemq.ts) | [handlers](#activemq-example:handlers/orders.ts) | [schema](#activemq-example:schemas/order.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { activeMQRouter } from './activemq.js'

const lambdaRouter = new LambdaRouter({
  routers: [activeMQRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'activemq.ts',
    code: `import { createActiveMQRouter } from '@lambda-event-router/mq'

import { onUnknownMessage, processOrder, storeScan } from './handlers/orders.js'
import { OrderSchema } from './schemas/order.js'

const BROKER_ARN = 'arn:aws:mq:eu-west-2:123456789012:broker:trading:b-1234'

export const activeMQRouter = createActiveMQRouter()

activeMQRouter
  .textMessage({
    filters: {
      eventSourceArn: BROKER_ARN,
      destination: 'orders',
    },
    bodySchema: OrderSchema,
    handler: processOrder,
  })
  .bytesMessage({
    filters: {
      eventSourceArn: BROKER_ARN,
      destination: 'scans',
    },
    handler: storeScan,
  })
  .route({
    filters: {},
    handler: onUnknownMessage,
  })`,
  },
  {
    path: 'handlers/orders.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type {
  ActiveMQBytesMessageRequest,
  ActiveMQRequest,
  ActiveMQResponse,
  ActiveMQTextMessageRequest,
} from '@lambda-event-router/mq'

import type { Order } from '../schemas/order.js'

export async function processOrder(
  request: ActiveMQTextMessageRequest<Order>,
): Promise<ActiveMQResponse> {
  logger.info(\`Processing order \${request.body.orderId} for \${request.body.total}\`)
}

export async function storeScan(request: ActiveMQBytesMessageRequest): Promise<ActiveMQResponse> {
  // body is a Buffer of the raw bytes
  const scan = request.body

  logger.info(\`Storing a \${scan.byteLength} byte scan from \${request.destination}\`)
}

export async function onUnknownMessage(request: ActiveMQRequest): Promise<ActiveMQResponse> {
  logger.warn(\`Dropping a \${request.messageType} from \${request.destination}\`)
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

<CodeFileViewer :files="files" id="activemq-example" default-file="activemq.ts" line-numbers collapse-toggle fixed-height />

The first two routes differ by destination and by message type, so no message can match both and the
order they are registered in makes no difference to them.

The catch-all is the one route that cares where it sits, since empty filters match anything. Register
it last and it takes what the other two turned down, which here is a bytes message on `orders` as much
as anything from a third destination. Without it those throw, and a throw takes the rest of the batch
with it.

`storeScan` reads `request.body`, which the router hands over as a `Buffer` of the raw bytes. A scan is
not text, so it never goes through the UTF-8 decode the text messages take. See
[message types](#message-types) for how a bytes message differs from a text one.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

# RabbitMQRouter

`RabbitMQRouter` routes Amazon MQ for RabbitMQ messages to handlers, one message at a time.

An event carries messages grouped by queue, and every message body arrives base64 encoded. The router
decodes each one, parses it as JSON, then works out which of your routes should handle it. Your handler
deals with one message and never sees the batch.

## Install

```bash
npm install @lambda-event-router/mq
```

`@lambda-event-router/base` comes along as a dependency, so you do not need to install it yourself.

The package holds `ActiveMQRouter` as well, so the functions are named per router. You want
`createRabbitMQRouter` and `defineRabbitMQRoute` rather than the `createRouter` and `defineRoute` a
single router package gives you.

## Create the router

```ts
import { createRabbitMQRouter } from '@lambda-event-router/mq'
import { logInvocation } from './middleware/logInvocation'

const rabbitMQRouter = createRabbitMQRouter({
  middleware: [logInvocation],  // Optional
})
```

The one option can be left out, so `createRabbitMQRouter()` is what you want most of the time.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `RabbitMQMiddleware[]` | No | `[]` | Runs for every message this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
rabbitMQRouter.route({
  filters: {
    queue: 'orders',
    contentType: 'application/json',
  },
  bodySchema: OrderSchema,  // Optional
  middleware: [withOrderContext],  // Optional
  handler: processOrder,
})
```

`filters` and `handler` are the only required keys.

`route()` returns the router, so you can chain registrations.

```ts
rabbitMQRouter.route(processOrderRoute).route(refundOrderRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A message that matches no route throws**, which fails the invocation and leaves the messages behind
it in the batch unhandled. Register a catch-all route with empty `filters` if you would rather swallow
unknown messages, and see [nothing matched](/docs/routing#nothing-matched) for what the other routers
do instead.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the messages you want and leave the rest off.

```ts
rabbitMQRouter.route({
  filters: {
    eventSourceArn: BROKER_ARN,
    queue: ['orders', 'priority-orders'], // Or a pattern: /-retry$/
    virtualHost: '/production',
    contentType: 'application/json',
    custom: ({ record }) => {
      // Only a custom reaches the message itself
      return record.basicProperties.priority >= HIGH_PRIORITY
    },
  },
  handler: processOrder,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `eventSourceArn` | `FilterStringMatcher` | Matches the ARN of the broker the event came from |
| `queue` | `FilterStringMatcher` | Matches the queue name, with the virtual host split off. See [Queue names](#queue-names) |
| `virtualHost` | `FilterStringMatcher` | Matches the virtual host the queue lives on. See [Queue names](#queue-names) |
| `contentType` | `FilterStringMatcher` | Matches `basicProperties.contentType`, when the message has one |
| `custom` | `(input: RabbitMQFilterInput) => boolean \| Promise<boolean>` | Anything the other keys cannot express, given the `queue`, the `virtualHost`, the `contentType`, the decoded `message` and the raw `record`. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**A message with no content type never matches a `contentType` filter.** Content type is an optional
AMQP property, so a publisher can leave it off. When it is absent the router skips a `contentType`
filter rather than matching it, the same way an absent virtual host skips a `virtualHost` filter. So
`contentType: '*'` picks out the messages that have a content type, not every message.

`custom` is the only key that reaches `basicProperties`, so priority, headers, `correlationId`
and the `redelivered` flag are filterable through it and nowhere else.

**`custom` gets no parsed body.** Schema validation runs after a route matches, so parse `message.data`
yourself to route on the contents. The filter sees the same split as the handler: `message` has its
`data` decoded to text and `record` is the untouched AWS message with `data` still base64. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

### Queue names

An event groups its messages by queue, and RabbitMQ names each group `queueName::virtualHost`. A group
named `orders::/production` holds the messages from the `orders` queue on the `/production` virtual
host.

The router splits the two apart, so `request.queue` is `orders` and `request.virtualHost` is
`/production`. The `queue` filter matches against the name and the `virtualHost` filter against the
host.

**Use `queue: 'orders'`, not `queue: 'orders::/production'`.** The `queue` filter sees the name on its
own, so a value with the virtual host in it matches nothing. Pick the host with `virtualHost` instead.

The same queue name in two virtual hosts routes apart once you add a `virtualHost` filter, and a
handler reads `request.virtualHost` to tell which host a message came from. A key with no `::` carries
no virtual host, so `request.virtualHost` is `undefined` and a `virtualHost` filter never matches it.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { RabbitMQRequest, RabbitMQResponse } from '@lambda-event-router/mq'

export async function processOrder(
  request: RabbitMQRequest<Order>,
): Promise<RabbitMQResponse> {
  const { orderId, total } = request.body
  logger.info(`Processing order ${orderId} for ${total} from ${request.queue}`)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `message` | `RabbitMQMessage` | The message with `data` decoded from base64 to text |
| `queue` | `string` | The queue name, without the virtual host |
| `virtualHost` | `string \| undefined` | The virtual host the queue lives on. `undefined` when the queue key carries none |
| `body` | `TBody` | The decoded data parsed as JSON. Data that is not JSON reaches you as the raw string |
| `record` | `RabbitMQMessage` | The untouched message from AWS, so `data` is still base64 |
| `context` | `Context` | The Lambda context |

`RabbitMQMessage` and `RabbitMQBasicProperties` are declared by this package, since `aws-lambda`
carries no RabbitMQ types. `Context` does come from `aws-lambda`.

**`message` and `record` differ by one field.** `message.data` is the decoded text and `record.data` is
the base64 AWS sent, so reading `record.data` for your message body hands you base64. `basicProperties`
and `redelivered` are the same on both.

### Response type

`RabbitMQResponse` is `undefined`. There is nothing useful to return to a broker, so handlers return
`Promise<RabbitMQResponse>` and the router works out what to hand back to Lambda.

Throwing is how you signal failure. See [Failures and retries](#failures-and-retries) for what that
does to the rest of the batch.

### Inferred handlers

Nothing to look up and nothing to keep in sync. `defineRabbitMQRoute` reads the schema and hands your
handler a fully typed `body`, defaults and coercion included, so `total` below is a `number` without
you declaring that anywhere.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRabbitMQRoute } from '@lambda-event-router/mq'
import { z } from 'zod'

const OrderSchema = z.object({ orderId: z.string(), total: z.coerce.number() })

export const processOrderRoute = defineRabbitMQRoute({
  filters: { queue: 'orders', contentType: 'application/json' },
  bodySchema: OrderSchema,
}).handle(async ({ body, queue }) => {
  logger.info(`Processing order ${body.orderId} for ${body.total} from ${queue}`)
})

rabbitMQRouter.route(processOrderRoute)
```

Inference pays off most in a Lambda taking several event sources, since you never have to know any of
their request shapes. See [inferred handlers](/docs/handlers#inferred-handlers), where the same queue
is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`RabbitMQRequest`](#generic-parameters) and your own types.

```ts
// handlers/processOrder.ts
import { logger } from '@lambda-event-router/base'
import type { RabbitMQRequest, RabbitMQResponse } from '@lambda-event-router/mq'
import { z } from 'zod'

export const OrderSchema = z.object({ orderId: z.string(), total: z.number() })
type Order = z.infer<typeof OrderSchema>

export async function processOrder(request: RabbitMQRequest<Order>): Promise<RabbitMQResponse> {
  logger.info(`Processing order ${request.body.orderId}`)
}
```

```ts
// rabbitmq.ts
import { createRabbitMQRouter } from '@lambda-event-router/mq'
import { OrderSchema, processOrder } from './handlers/processOrder'

const rabbitMQRouter = createRabbitMQRouter()

rabbitMQRouter.route({
  filters: { queue: 'orders', contentType: 'application/json' },
  bodySchema: OrderSchema,
  handler: processOrder,
})
```

Derive the type from the schema with `z.infer` rather than hand-writing an interface that mirrors it.
Both forms hand the handler the same request here, and [annotated
handlers](/docs/handlers#annotated-handlers) has the worked version.

## Schema validation

One key takes a schema, and it is optional.

```ts
const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

rabbitMQRouter.route({
  filters: { queue: 'orders', contentType: 'application/json' },
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

**Data that is not JSON reaches the schema as a string.** A `z.object()` rejects that, so every plain
text message on the queue throws. Pair a `bodySchema` with `contentType: 'application/json'` and give
the rest of the traffic its own route.

## Failures and retries

A handler that throws fails the invocation. Messages are handled one at a time, queue by queue in the
order the event lists them, so a throw stops everything behind it in the batch from running.

The router has no way to report single messages back to Lambda, so a failure applies to all of them.
None are acknowledged, the broker redelivers the whole batch, and the messages that already succeeded
run a second time. Make handlers safe to run twice and read `message.redelivered` where a repeat costs
something.

The batch size on the event source mapping decides how much gets replayed, so a smaller batch means
less repeated work after a failure.

A message matching no route throws the same way, naming the queue and broker ARN it could not place.

## Middleware

Router and route middleware are both typed `RabbitMQMiddleware`, and the chain runs once per message,
so a batch of ten messages runs it ten times.

```ts
import { logger } from '@lambda-event-router/base'
import type { RabbitMQMiddleware } from '@lambda-event-router/mq'

export const logInvocation: RabbitMQMiddleware = async (request, next) => {
  logger.info(`Handling a ${request.message.basicProperties.contentType} message on ${request.queue}`)
  return next(request)
}
```

```ts
const rabbitMQRouter = createRabbitMQRouter({ middleware: [logInvocation] })

rabbitMQRouter.route({
  filters: { queue: 'orders' },
  middleware: [withOrderContext],
  handler: processOrder,
})
```

`RabbitMQMiddleware` takes no type parameters, so `request.body` is `unknown` inside middleware
whatever the route's schema says. See [middleware](/docs/middleware) for the execution order and the
three levels it attaches at.

## Types

All exported from `@lambda-event-router/mq`.

| Type | Description |
| --- | --- |
| `RabbitMQRequest<TBody>` | The handler argument |
| `RabbitMQResponse` | Handler return type, `undefined` |
| `RabbitMQFilters` | The `filters` object |
| `RabbitMQFilterInput` | What `custom` receives |
| `RabbitMQRouteDefinition<TBody>` | A full route passed to `route()` |
| `RabbitMQRouterOptions` | Options for `createRabbitMQRouter` |
| `RabbitMQMiddleware` | Router and route middleware |
| `RabbitMQMessage` | One message, as `request.message` and `request.record` |
| `RabbitMQBasicProperties` | The AMQP properties on a message |
| `RabbitMQEvent` | The whole event, with its messages keyed by queue |

The `RabbitMQRouter` class and the `createRabbitMQRouter` and `defineRabbitMQRoute` functions come from
the same place.

### Generic parameters

Two of the types above take a parameter, and it is the same one.

| Parameter | Types | Default |
| --- | --- | --- |
| `TBody` | `request.body` | `unknown` |

Leave it off and the body is `unknown`, which is what `RabbitMQMiddleware` and `RabbitMQFilterInput`
see however the route is typed. You only need it for [annotated handlers](#annotated-handlers), since
inference covers the rest.

## Code example

An orders queue and a refunds queue on one broker, with anything else logged and dropped.

Open a file: [index.ts](#rabbitmq-example:index.ts) | [RabbitMQ router](#rabbitmq-example:rabbitmq.ts) | [handlers](#rabbitmq-example:handlers/orders.ts) | [schema](#rabbitmq-example:schemas/order.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { rabbitMQRouter } from './rabbitmq.js'

const lambdaRouter = new LambdaRouter({
  routers: [rabbitMQRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'rabbitmq.ts',
    code: `import { createRabbitMQRouter } from '@lambda-event-router/mq'

import { onUnknownMessage, processOrder, refundOrder } from './handlers/orders.js'
import { OrderSchema } from './schemas/order.js'

const BROKER_ARN = 'arn:aws:mq:eu-west-2:123456789012:broker:trading:b-1234'

export const rabbitMQRouter = createRabbitMQRouter()

rabbitMQRouter
  .route({
    filters: {
      eventSourceArn: BROKER_ARN,
      queue: 'orders',
      contentType: 'application/json',
    },
    bodySchema: OrderSchema,
    handler: processOrder,
  })
  .route({
    filters: {
      eventSourceArn: BROKER_ARN,
      queue: 'refunds',
      contentType: 'application/json',
    },
    bodySchema: OrderSchema,
    handler: refundOrder,
  })
  .route({
    filters: {},
    handler: onUnknownMessage,
  })`,
  },
  {
    path: 'handlers/orders.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { RabbitMQRequest, RabbitMQResponse } from '@lambda-event-router/mq'

import type { Order } from '../schemas/order.js'

export async function processOrder(request: RabbitMQRequest<Order>): Promise<RabbitMQResponse> {
  logger.info(\`Processing order \${request.body.orderId}\`)
}

export async function refundOrder(request: RabbitMQRequest<Order>): Promise<RabbitMQResponse> {
  logger.info(\`Refunding order \${request.body.orderId} for \${request.body.total}\`)
}

export async function onUnknownMessage(request: RabbitMQRequest): Promise<RabbitMQResponse> {
  const { contentType } = request.message.basicProperties

  logger.warn(\`Dropping a \${contentType} message from \${request.queue}\`)
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

<CodeFileViewer :files="files" id="rabbitmq-example" default-file="rabbitmq.ts" line-numbers collapse-toggle fixed-height />

The first two routes match a different queue, so no message can match both and the order they are
registered in makes no difference to them.

The catch-all is the one route that cares where it sits, since empty filters match anything. Register
it last and it takes what the other two turned down, which here is a plain text message on `orders` as
much as anything from a third queue. Without it those throw, and a throw takes the rest of the batch
with it.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

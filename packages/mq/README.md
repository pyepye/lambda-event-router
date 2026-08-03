# @lambda-event-router/mq

Amazon MQ routing for both ActiveMQ and RabbitMQ brokers.

**Supported AWS Services:** `Amazon MQ`

**Available Routers:** `ActiveMQRouter` | `RabbitMQRouter`

(See [Routers](#routers) for more details)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/mq
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


## Quick Start

This example is for the ActiveMQRouter. See [Usage](#usage) for examples of the other routers

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { activeMQRouter } from './mq'

const lambdaRouter = new LambdaRouter({
  routers: [activeMQRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// mq.ts
import { createActiveMQRouter, defineActiveMQRoute } from '@lambda-event-router/mq'

const activeMQRouter = createActiveMQRouter()

// Inline functions allows Typescript to automatic infer types
const processMessage = defineActiveMQRoute({
  filters: {
    destination: 'order-queue',
  },
}).handle(async ({ body, destination }) => {
  console.log(`Message from ${destination}`, body)
})
activeMQRouter.route(processMessage)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// mq.ts
import { createActiveMQRouter, type ActiveMQRequest } from '@lambda-event-router/mq'

const activeMQRouter = createActiveMQRouter()

// Separate handler to define routes and handlers in different places
activeMQRouter.route({
  filters: { destination: 'order-queue' },
  handler: processMessage,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processMessage({ body, destination }: ActiveMQRequest) {
  console.log(`Message from ${destination}`, body)
}
```


## Routers

| AWS Service | Event Source | Router | Usage
|---|---|---|---|
| Amazon MQ | ActiveMQ | `ActiveMQRouter` | [ActiveMQRouter](#activemqrouter) |
| Amazon MQ | RabbitMQ | `RabbitMQRouter` | [RabbitMQRouter](#rabbitmqrouter) |


## Usage

### ActiveMQRouter

#### Inline handlers

```ts
import { createActiveMQRouter, defineActiveMQRoute } from '@lambda-event-router/mq'

const activeMQRouter = createActiveMQRouter()

const processMessage = defineActiveMQRoute({
  filters: {
    destination: 'order-queue',
  },
}).handle(async ({ body, destination }) => {
  console.log(`Message from ${destination}`, body)
})

activeMQRouter.route(processMessage)
```

#### Separate handlers

```ts
import { createActiveMQRouter, type ActiveMQRequest } from '@lambda-event-router/mq'

const activeMQRouter = createActiveMQRouter()

activeMQRouter.route({
  filters: { destination: 'order-queue' },
  handler: processMessage,
})

async function processMessage({ body, destination }: ActiveMQRequest) {
  console.log(`Message from ${destination}`, body)
}
```

#### Message type routes

`textMessage()` and `bytesMessage()` set the `messageType` filter for you, so the handler is given the
matching request type.

```ts
activeMQRouter.textMessage({
  filters: { destination: 'order-queue' },
  handler: processMessage,
})
```

A bytes message body is a `Buffer` of the raw bytes, decoded from base64. Text messages are parsed as
JSON, so `bytesMessage()` takes no `bodySchema`.

#### Filters

```ts
defineActiveMQRoute({
  filters: {
    eventSourceArn: 'arn:aws:mq:eu-west-2:123456789012:broker:MyBroker:b-1234',
    destination: ['order-queue', 'refund-queue'],
    messageType: 'jms/text-message',
    custom: ({ message }) => message.properties.orderPriority === 'urgent',
  },
})
```

Amazon MQ omits a field rather than sending it empty. `message.properties` is filled in with an empty
object so a filter can read it either way, and `record.properties` is left as Amazon MQ sent it. The
same goes for `correlationID` and `type`, which are absent unless the sender sets them.

Every AMQP property is on a RabbitMQ message, and one the publisher did not set arrives as `null`.
That includes `contentType`, so a message with no content type never matches a `contentType` filter.

`request.timestamp` is the `timestamp` property parsed to a `Date`. Amazon MQ sends it as UTC text with
no time zone, such as `Sep 21, 2026, 2:13:20 PM`, and the router reads it as UTC. It is `null` when
there is no timestamp or the text is in a format the router does not recognise.

A string header arrives as its UTF-8 bytes, such as `{ bytes: [117, 114, 103, 101, 110, 116] }` for
`'urgent'`. `RabbitMQHeaderValue` types every shape a header can take.

### RabbitMQRouter

#### Inline handlers

```ts
import { createRabbitMQRouter, defineRabbitMQRoute } from '@lambda-event-router/mq'

const rabbitMQRouter = createRabbitMQRouter()

const processMessage = defineRabbitMQRoute({
  filters: {
    queue: 'order-queue',
  },
}).handle(async ({ body, queue }) => {
  console.log(`Message from ${queue}`, body)
})

rabbitMQRouter.route(processMessage)
```

#### Separate handlers

```ts
import { createRabbitMQRouter, type RabbitMQRequest } from '@lambda-event-router/mq'

const rabbitMQRouter = createRabbitMQRouter()

rabbitMQRouter.route({
  filters: { queue: 'order-queue' },
  handler: processMessage,
})

async function processMessage({ body, queue }: RabbitMQRequest) {
  console.log(`Message from ${queue}`, body)
}
```

The queue is keyed as `queueName::virtualHost` in the event. The router splits the two apart, so the
`queue` filter and `request.queue` give you the name and the `virtualHost` filter and
`request.virtualHost` give you the host. A key with no `::` leaves `request.virtualHost` `undefined`.

#### Filters

```ts
defineRabbitMQRoute({
  filters: {
    eventSourceArn: 'arn:aws:mq:eu-west-2:123456789012:broker:MyBroker:b-1234',
    queue: ['order-queue', 'refund-queue'],
    virtualHost: '/production',
    contentType: 'application/json',
    custom: ({ record }) => (record.basicProperties.priority ?? 0) >= 5,
  },
})
```

### Middleware

Register middleware on the router to cover every route, or on a single route. Type route middleware to
the route's `bodySchema`. Each router has its own alias.

```ts
import type { ActiveMQMiddleware, RabbitMQMiddleware } from '@lambda-event-router/mq'

const withOrderContext: RabbitMQMiddleware<Order> = async (request, next) => {
  console.log(`Order ${request.body.orderId}`)
  return next(request)
}

// The second parameter pins the request to one message type
const withTextOrderContext: ActiveMQMiddleware<Order, 'jms/text-message'> = async (request, next) => {
  console.log(`Order ${request.body.orderId}`)
  return next(request)
}
```

## Examples

See the [service-examples/mq](../../service-examples/mq) directory for complete working examples.

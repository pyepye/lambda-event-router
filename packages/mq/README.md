# @lambda-event-router/mq

Amazon MQ routing for both ActiveMQ and RabbitMQ brokers.

**Supported AWS Services:** `Amazon MQ`

**Available Routers:** `ActiveMQRouter` | `RabbitMQRouter`

(See [Routers](#routers) for more details)

## Install

```bash
npm install @lambda-event-router/mq
```


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
    customFilter: ({ destination }) => destination.includes('priority'),
  },
})
```

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
    customFilter: ({ record }) => record.basicProperties.priority >= 5,
  },
})
```

## Examples

See the [examples/mq](../../examples/mq) directory for complete working examples.

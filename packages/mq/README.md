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
    queues: ['order-queue'],
  },
}).handle(async ({ data, queue }) => {
  console.log(`Message from ${queue}`)
})
activeMQRouter.route(processMessage)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// mq.ts
import { createActiveMQRouter } from '@lambda-event-router/mq'

const activeMQRouter = createActiveMQRouter()

// Separate handler to define routes and handlers in different places
activeMQRouter.route({
  filters: { queues: ['order-queue'] },
  handler: processMessage,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processMessage({ data, queue }) {
  console.log(`Message from ${queue}`)
}
```


## Routers

| AWS Service | Event Source | Router | Usage
|---|---|---|---|
| Amazon MQ | ActiveMQ | `ActiveMQRouter` | <Usage link here> |
| Amazon MQ | RabbitMQ | `RabbitMQRouter` | <Usage link here> |


## Usage

### ActiveMQRouter

#### Inline handlers

```ts
import { createActiveMQRouter, defineActiveMQRoute } from '@lambda-event-router/mq'

const activeMQRouter = createActiveMQRouter()

const processMessage = defineActiveMQRoute({
  filters: {
    queues: ['order-queue'],
  },
}).handle(async ({ data, queue }) => {
  console.log(`Message from ${queue}`)
})

activeMQRouter.route(processMessage)
```

#### Separate handlers

```ts
import { createActiveMQRouter } from '@lambda-event-router/mq'

const activeMQRouter = createActiveMQRouter()

activeMQRouter.route({
  filters: { queues: ['order-queue'] },
  handler: processMessage,
})

async function processMessage({ data, queue }) {
  console.log(`Message from ${queue}`)
}
```

#### Filters

```ts
defineActiveMQRoute({
  filters: {
    queues: ['order-queue'],
    destinations: ['queue://orders'],
    messageTypes: ['TextMessage'],
    customFilter: ({ message }) => message.destination.includes('priority'),
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
    queues: ['order-queue'],
  },
}).handle(async ({ data, queue }) => {
  console.log(`Message from ${queue}`)
})

rabbitMQRouter.route(processMessage)
```

#### Separate handlers

```ts
import { createRabbitMQRouter } from '@lambda-event-router/mq'

const rabbitMQRouter = createRabbitMQRouter()

rabbitMQRouter.route({
  filters: { queues: ['order-queue'] },
  handler: processMessage,
})

async function processMessage({ data, queue }) {
  console.log(`Message from ${queue}`)
}
```

#### Filters

```ts
defineRabbitMQRoute({
  filters: {
    queues: ['order-queue'],
    customFilter: ({ message }) => message.basicProperties.contentType === 'application/json',
  },
})
```

## Examples

See the [examples/mq](../../examples/mq) directory for complete working examples.

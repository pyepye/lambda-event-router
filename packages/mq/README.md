# @lambda-event-router/mq

Routes each Amazon MQ message to a handler, for ActiveMQ and RabbitMQ brokers. The router decodes the body, so your handler sees one message and never the batch.

**Supported AWS Services:** `Amazon MQ`

**Available Routers:** `ActiveMQRouter` | `RabbitMQRouter`

**Docs:** [ActiveMQRouter](https://pyepye.github.io/lambda-event-router/routers/ActiveMQRouter) | [RabbitMQRouter](https://pyepye.github.io/lambda-event-router/routers/RabbitMQRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/mq
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { activeMQRouter } from './activemq'
import { rabbitMQRouter } from './rabbitmq'

const lambdaRouter = new LambdaRouter({
  routers: [activeMQRouter, rabbitMQRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// activemq.ts
import { createActiveMQRouter, defineActiveMQRoute } from '@lambda-event-router/mq'
import { z } from 'zod'

export const activeMQRouter = createActiveMQRouter()

const processOrder = defineActiveMQRoute({
  filters: {
    eventSourceArn: 'arn:aws:mq:eu-west-2:123456789012:broker:orders-broker:b-1234abcd-56ef-78ab-90cd-1234567890ab',
    destination: 'orders',
    messageType: 'jms/text-message',
  },
  bodySchema: z.object({ orderId: z.string() }),
}).handle(async ({ body, destination }) => {
  console.log(`Processing order ${body.orderId} from ${destination}`)
})

activeMQRouter.route(processOrder)
```

```ts
// rabbitmq.ts
import { createRabbitMQRouter, defineRabbitMQRoute } from '@lambda-event-router/mq'
import { z } from 'zod'

export const rabbitMQRouter = createRabbitMQRouter()

const processOrder = defineRabbitMQRoute({
  filters: {
    eventSourceArn: 'arn:aws:mq:eu-west-2:123456789012:broker:orders-broker:b-9876dcba-54fe-32ba-10dc-0987654321ba',
    queue: 'orders',
    virtualHost: '/production',
    contentType: 'application/json',
  },
  bodySchema: z.object({ orderId: z.string() }),
}).handle(async ({ body, virtualHost }) => {
  console.log(`Processing order ${body.orderId} on ${virtualHost}`)
})

rabbitMQRouter.route(processOrder)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/ActiveMQRouter#annotated-handlers).

## Documentation

- [ActiveMQRouter](https://pyepye.github.io/lambda-event-router/routers/ActiveMQRouter) covers every filter, message types, schema validation
  and failures and retries.
- [RabbitMQRouter](https://pyepye.github.io/lambda-event-router/routers/RabbitMQRouter) covers every filter, schema validation and failures
  and retries.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/mq](../../service-examples/mq) for a deployable app.

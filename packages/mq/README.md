# @latcher/mq

Routes each Amazon MQ message to a handler, for ActiveMQ and RabbitMQ brokers. The matcher decodes the body, so your handler sees one message and never the batch.

**Supported AWS Services:** `Amazon MQ`

**Available Matchers:** `ActiveMQMatcher` | `RabbitMQMatcher`

**Docs:** [ActiveMQMatcher](https://pyepye.github.io/latcher/matchers/ActiveMQMatcher) | [RabbitMQMatcher](https://pyepye.github.io/latcher/matchers/RabbitMQMatcher)

## Install

```bash
npm install @latcher/base @latcher/mq
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { activeMQMatcher } from './activemq'
import { rabbitMQMatcher } from './rabbitmq'

const latcher = new Latcher({
  matchers: [activeMQMatcher, rabbitMQMatcher],
})

export const handler = latcher.handler()
```

```ts
// activemq.ts
import { createActiveMQMatcher, defineActiveMQRoute } from '@latcher/mq'
import { z } from 'zod'

export const activeMQMatcher = createActiveMQMatcher()

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

activeMQMatcher.route(processOrder)
```

```ts
// rabbitmq.ts
import { createRabbitMQMatcher, defineRabbitMQRoute } from '@latcher/mq'
import { z } from 'zod'

export const rabbitMQMatcher = createRabbitMQMatcher()

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

rabbitMQMatcher.route(processOrder)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/ActiveMQMatcher#annotated-handlers).

## Documentation

- [ActiveMQMatcher](https://pyepye.github.io/latcher/matchers/ActiveMQMatcher) covers every filter, message types, schema validation
  and failures and retries.
- [RabbitMQMatcher](https://pyepye.github.io/latcher/matchers/RabbitMQMatcher) covers every filter, schema validation and failures
  and retries.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/mq](../../service-examples/mq) for a deployable app.

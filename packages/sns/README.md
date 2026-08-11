# @lambda-event-router/sns

Routes each SNS notification to a handler by topic, subject or message attribute. The router parses the message and converts its attributes before your handler runs.

**Supported AWS Services:** `Amazon SNS`

**Available Routers:** `SNSRouter`

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/sns
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { snsRouter } from './sns'

const lambdaRouter = new LambdaRouter({
  routers: [snsRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// sns.ts
import { createSNSRouter, defineRoute } from '@lambda-event-router/sns'
import { z } from 'zod'

const snsRouter = createSNSRouter()

// An inferred handler takes its types from the route
const processNotification = defineRoute({
  filters: { topicArn: 'arn:aws:sns:us-east-1:123456789:my-topic' },
  bodySchema: z.object({ name: z.string(), price: z.number() }),
}).handle(async ({ body }) => {
  console.log(`Creating item: ${body.name} - $${body.price}`)
})
snsRouter.route(processNotification)
```

Or use an annotated handler, which names its types rather than inferring them:

```ts
// sns.ts
import { createSNSRouter } from '@lambda-event-router/sns'
import type { SNSRequest } from '@lambda-event-router/sns'
import { z } from 'zod'

const ItemSchema = z.object({ name: z.string(), price: z.number() })
type Item = z.infer<typeof ItemSchema>

const snsRouter = createSNSRouter()

snsRouter.route({
  filters: { topicArn: 'arn:aws:sns:us-east-1:123456789:my-topic' },
  bodySchema: ItemSchema,
  handler: processNotification,
})

// An annotated handler names its own types
export async function processNotification({ body }: SNSRequest<Item>) {
  console.log(`Creating item: ${body.name} - $${body.price}`)
}
```


## Usage

#### Inferred handlers

```ts
import { createSNSRouter, defineRoute } from '@lambda-event-router/sns'

const snsRouter = createSNSRouter()

const processNotification = defineRoute({
  filters: { topicArn: 'arn:aws:sns:us-east-1:123456789:my-topic' },
  bodySchema: BodySchema,
  messageAttributesSchema: MessageAttributesSchema,
}).handle(async ({ body, messageAttributes }) => {
  console.log(`Creating item: ${body.name} - $${body.price}`)
  console.log(`dryRun: ${messageAttributes.dryRun}`)
})

snsRouter.route(processNotification)
```

#### Annotated handlers

```ts
import { createSNSRouter } from '@lambda-event-router/sns'
import type { SNSRequest } from '@lambda-event-router/sns'
import type { z } from 'zod'

type Item = z.infer<typeof BodySchema>
type Attributes = z.infer<typeof MessageAttributesSchema>

const snsRouter = createSNSRouter()

snsRouter.route({
  filters: { topicArn: 'arn:aws:sns:us-east-1:123456789:my-topic' },
  bodySchema: BodySchema,
  messageAttributesSchema: MessageAttributesSchema,
  handler: processNotification,
})

async function processNotification({ body, messageAttributes }: SNSRequest<Item, Attributes>) {
  console.log(`Creating item: ${body.name} - $${body.price}`)
  console.log(`dryRun: ${messageAttributes.dryRun}`)
}
```

#### Filters

```ts
// Single values
defineRoute({
  filters: {
    topicArn: 'arn:aws:sns:us-east-1:123456789:my-topic',
    subject: 'Order Created',
    messageAttributes: { environment: 'production' },
  },
})

// Multiple values
defineRoute({
  filters: {
    topicArn: ['arn:aws:sns:us-east-1:123456789:topic-a', 'arn:aws:sns:us-east-1:123456789:topic-b'],
    subject: ['Order Created', 'Order Updated'],
    messageAttributes: { environment: ['production', 'staging'] },
    custom: ({ body }) => {
      if (typeof body !== 'object' || body === null) return false
      return 'urgency' in body && body.urgency === 'CRITICAL'
    },
  },
})
```

#### Message attributes schema

```ts
const MessageAttributesSchema = z.object({
  dryRun: z.coerce.boolean().default(false),
})

defineRoute({
  filters: { topicArn: 'arn:aws:sns:us-east-1:123456789:my-topic' },
  bodySchema: BodySchema,
  messageAttributesSchema: MessageAttributesSchema,
}).handle(async ({ body, messageAttributes }) => {
  console.log(`dryRun: ${messageAttributes.dryRun}`)
})
```

#### Message attribute types

`Publish` takes four types, but a Lambda subscription receives two. A custom label such as
`Number.float` is dropped on the way.

| You publish | Your handler gets |
| --- | --- |
| `String` | the string |
| `Number` | the digits, as a string |
| `String.Array` | the JSON text, as a string |
| `Binary` | a `Buffer`, decoded from base64 |

Only `Binary` is converted for you. Coerce the rest in your `messageAttributesSchema`.

## Examples

See the [service-examples/sns](../../service-examples/sns) directory for complete working examples.

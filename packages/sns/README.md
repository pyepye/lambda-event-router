# @lambda-event-router/sns

SNS notification routing by topic ARN, subject, and message attributes with schema validation.

**Supported AWS Services:** `Amazon SNS`

**Available Routers:** `SNSRouter`

## Install

```bash
npm install @lambda-event-router/sns
```


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

// Inline functions allows Typescript to automatic infer types
const processNotification = defineRoute({
  filters: { topicArn: 'arn:aws:sns:us-east-1:123456789:my-topic' },
  bodySchema: z.object({ name: z.string(), price: z.number() }),
}).handle(async ({ body }) => {
  console.log(`Creating item: ${body.name} - $${body.price}`)
})
snsRouter.route(processNotification)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// sns.ts
import { createSNSRouter } from '@lambda-event-router/sns'

const snsRouter = createSNSRouter()

// Separate handler to define routes and handlers in different places
snsRouter.route({
  filters: { topicArn: 'arn:aws:sns:us-east-1:123456789:my-topic' },
  bodySchema: BodySchema,
  handler: processNotification,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processNotification({ body }) {
  console.log(`Creating item: ${body.name} - $${body.price}`)
}
```


## Usage

#### Inline handlers

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

#### Separate handlers

```ts
import { createSNSRouter } from '@lambda-event-router/sns'

const snsRouter = createSNSRouter()

snsRouter.route({
  filters: { topicArn: 'arn:aws:sns:us-east-1:123456789:my-topic' },
  bodySchema: BodySchema,
  messageAttributesSchema: MessageAttributesSchema,
  handler: processNotification,
})

async function processNotification({ body, messageAttributes }) {
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
    customFilter: ({ body }) => {
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

## Examples

See the [examples/sns](../../examples/sns) directory for complete working examples.

# @lambda-event-router/sqs

SQS message routing with schema validation, message attribute filtering, and batch failure support.

**Supported AWS Services:** `Amazon SQS`

**Available Routers:** `SQSRouter`

## Install

```bash
npm install @lambda-event-router/sqs
```


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { sqsRouter } from './sqs'

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// sqs.ts
import { createSQSRouter, defineRoute } from '@lambda-event-router/sqs'
import { z } from 'zod'

const sqsRouter = createSQSRouter()

// Inline functions allows Typescript to automatic infer types
const processOrder = defineRoute({
  filters: { eventSourceArn: 'arn:aws:sqs:us-east-1:123456789:my-queue' },
  bodySchema: z.object({ name: z.string(), price: z.number() }),
}).handle(async ({ body }) => {
  console.log(`Creating item: ${body.name} - $${body.price}`)
})
sqsRouter.route(processOrder)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// sqs.ts
import { createSQSRouter } from '@lambda-event-router/sqs'

const sqsRouter = createSQSRouter()

// Separate handler to define routes and handlers in different places
sqsRouter.route({
  filters: { eventSourceArn: 'arn:aws:sqs:us-east-1:123456789:my-queue' },
  bodySchema: BodySchema,
  handler: processOrder,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processOrder({ body }) {
  console.log(`Creating item: ${body.name} - $${body.price}`)
}
```


## Usage

#### Inline handlers

```ts
import { createSQSRouter, defineRoute } from '@lambda-event-router/sqs'

const sqsRouter = createSQSRouter()

const processOrder = defineRoute({
  filters: { eventSourceArn: 'arn:aws:sqs:us-east-1:123456789:my-queue' },
  bodySchema: BodySchema,
  messageAttributesSchema: MessageAttributesSchema,
}).handle(async ({ body, messageAttributes }) => {
  console.log(`Creating item: ${body.name} - $${body.price}`)
  console.log(`dryRun: ${messageAttributes.dryRun}`)
})

sqsRouter.route(processOrder)
```

#### Separate handlers

```ts
import { createSQSRouter } from '@lambda-event-router/sqs'

const sqsRouter = createSQSRouter()

sqsRouter.route({
  filters: { eventSourceArn: 'arn:aws:sqs:us-east-1:123456789:my-queue' },
  bodySchema: BodySchema,
  messageAttributesSchema: MessageAttributesSchema,
  handler: processOrder,
})

async function processOrder({ body, messageAttributes }) {
  console.log(`Creating item: ${body.name} - $${body.price}`)
  console.log(`dryRun: ${messageAttributes.dryRun}`)
}
```

#### Filters

```ts
defineRoute({
  filters: {
    eventSourceArn: 'arn:aws:sqs:us-east-1:123456789:my-queue',
    messageAttributes: { environment: 'production' },
    customFilter: ({ body }) => {
      if (typeof body !== 'object' || body === null) return false
      return 'orderId' in body
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
  filters: { eventSourceArn: 'arn:aws:sqs:us-east-1:123456789:my-queue' },
  bodySchema: BodySchema,
  messageAttributesSchema: MessageAttributesSchema,
}).handle(async ({ body, messageAttributes }) => {
  console.log(`dryRun: ${messageAttributes.dryRun}`)
})
```

#### Batch failure reporting

```ts
const sqsRouter = createSQSRouter({ batchItemFailures: true })
```

When enabled, failed messages are reported back to SQS as partial batch failures instead of failing the entire batch.

## Examples

See the [examples/sqs](../../examples/sqs) directory for complete working examples.

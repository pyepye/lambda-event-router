---
layout: home

hero:
  name: Lambda Event Router
  text: Type-safe routing for AWS Lambda
  tagline: One handler, any event source. Route API Gateway, SQS, DynamoDB, S3 and more to the right code.
  image:
    light: /lambda-event-router-light.svg
    dark: /lambda-event-router-dark.svg
    alt: Lambda Event Router
  actions:
    - theme: brand
      text: Get Started
      link: /docs/
    - theme: alt
      text: GitHub
      link: https://github.com/pyepye/lambda-event-router

features:
  - title: 🔀 Multi-source routing
    details: Combine routers from different AWS services in a single Lambda handler.
  - title: 🛡️ Type-safe routing
    details: Full TypeScript support with inferred types from schemas and filters for inline handlers.
  - title: 🎛️ Declarative filters
    details: Route events by ARN, eventType, topic, bucket, event name, detail type, and custom filter functions.
  - title: 🧱 25+ AWS services
    details: Dedicated routers for SQS, SNS, EventBridge, DynamoDB Streams, S3, API Gateway, and many more.
  - title: ✅ Schema validation
    details: Built-in schema validation for request bodies, message attributes, path params, and more. Compatible with any Standard Schema compatible library.
  - title: 🧪 Well tested
    details: Clear and concise tests covering most code branches for each event type.
---

<div class="home-code-tabs">

::: code-group

```ts [index.ts]
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { apiRouter } from './api'
import { sqsRouter } from './sqs'

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter, sqsRouter],
})

export const handler = lambdaRouter.handler()
```

```ts [api.ts]
import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'

import { getOrder } from './getOrder'
import { createOrder, createOrderSchema } from './createOrder'

const apiRouter = createAPIGatewayRouter()

apiRouter.route({
  method: 'GET',
  path: '/order/:id/',
  handler: getOrder,
})

apiRouter.route({
  method: 'POST',
  path: '/order/:id/',
  handler: createOrder,
  bodySchema: createOrderSchema,
})
```

```ts [sqs.ts]
import { createSQSRouter } from '@lambda-event-router/sqs'

import { processOrder } from './order/process'
import { refundOrder } from './order/refund'

const sqsRouter = createSQSRouter()

sqsRouter.route({
  filter: { messageAttributes: { Type: ['ProcessOrder'] } },
  handler: processOrder,
})

sqsRouter.route({
  filter: { messageAttributes: { Type: ['RefundOrder'] } },
  handler: refundOrder,
})
```

:::

</div>

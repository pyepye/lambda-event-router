---
layout: home

hero:
  name: Latcher
  text: Type-safe event routing for AWS Lambda
  tagline: One handler, any event source. Route API Gateway, SQS, DynamoDB, S3 and more to the right code.
  image:
    light: /latcher-light.svg
    dark: /latcher-dark.svg
    alt: Latcher
  actions:
    - theme: brand
      text: Get Started
      link: /docs/
    - theme: alt
      text: GitHub
      link: https://github.com/pyepye/latcher

features:
  - title: 🔀 Multi-source routing
    details: Combine matchers from different AWS services in a single Lambda handler.
  - title: 🛡️ Type-safe routing
    details: Full TypeScript support, with handler types inferred from the schemas and filters on the route.
  - title: 🎛️ Declarative filters
    details: Route events by ARN, eventType, topic, bucket, event name, detail type, and custom filter functions.
  - title: 🧱 25 AWS services
    details: Dedicated matchers for SQS, SNS, EventBridge, DynamoDB Streams, S3, API Gateway, and many more.
  - title: ✅ Schema validation
    details: Built-in schema validation for request bodies, message attributes, path params, and more. Compatible with any Standard Schema compatible library.
  - title: 🧪 Well tested
    details: Clear and concise tests covering most code branches for each event type.
---

<div class="home-code-tabs">

::: code-group

```ts [index.ts]
// main handler
import { Latcher } from '@latcher/base'
import { apiMatcher } from './api'
import { sqsMatcher } from './sqs'

const latcher = new Latcher({
  matchers: [apiMatcher, sqsMatcher],
})

export const handler = latcher.handler()
```

```ts [api.ts]
import { createAPIGatewayMatcher } from '@latcher/apigateway'

import { getOrder } from './getOrder'
import { createOrder, createOrderSchema } from './createOrder'

const apiMatcher = createAPIGatewayMatcher()

apiMatcher.route({
  filters: {
    method: 'GET',
    path: '/order/:id/',
  },
  handler: getOrder,
})

apiMatcher.route({
  filters: {
    method: 'POST',
    path: '/order/:id/',
  },
  handler: createOrder,
  bodySchema: createOrderSchema,
})
```

```ts [sqs.ts]
import { createSQSMatcher } from '@latcher/sqs'

import { processOrder } from './order/process'
import { refundOrder } from './order/refund'

const sqsMatcher = createSQSMatcher()

sqsMatcher.route({
  filters: { messageAttributes: { Type: ['ProcessOrder'] } },
  handler: processOrder,
})

sqsMatcher.route({
  filters: { messageAttributes: { Type: ['RefundOrder'] } },
  handler: refundOrder,
})
```

:::

</div>

<hr class="home-divider" />

<HomeServices />

<HomeCallToAction />

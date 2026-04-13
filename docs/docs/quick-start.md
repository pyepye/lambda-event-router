# Quick Start


## Prerequisites

- AWS lambda
- NodeJS
- Blurb around packages and know which AWS services you need

## Install

- blurb and link to packages page
```bash
npm install @lambda-event-router/[package]
```

- When need to support multiple aws services
```bash
npm install @lambda-event-router/apigateway @lambda-event-router/sqs
```


## Your first lambda

- Break down into steps
1. LambdaRouter

```ts
import { LambdaRouter } from '@lambda-event-router/base'
import { sqsRouter } from './sqs'

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter]
})

export const handler = lambdaRouter.handler()
```

2. SQS Router
```ts
import { createSQSRouter } from '@lambda-event-router/sqs'

const sqsRouter = createSQSRouter()

// Separate handler to define routes and handlers in different places
sqsRouter.route({
  filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789:my-queue'] },
  bodySchema: BodySchema,
  handler: processOrder,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processOrder({ body }) {
  console.log(`Creating item: ${body.name} - $${body.price}`)
}
```


## Multiple routers

- Example with file system with APIGateway, DynamoDB and SQS


Support file linking.

Open a file: [index.ts](#multi-router:index.ts) | [API router](#multi-router:routers/api.ts) | [SQS router](#multi-router:routers/sqs.ts) | [createItem handler](#multi-router:handlers/createItem.ts) | [package.json](#multi-router:package.json)

<!-- This is fake and needs replacing - it's just an example used for testing CodeFileViewer -->
<script setup>

// Get files from disk for CodeFileViewer
// import { fromGlob } from '../.vitepress/theme/utils/codeFiles'
// const separateHandlerFiles = fromGlob(import.meta.glob('/examples/separateHandler/**/*', { query: '?raw', eager: true }))

const files = [
  {
    path: 'index.ts',
    code: `import { LambdaRouter } from '@lambda-event-router/base'
import type { Handler } from 'aws-lambda'

import { apiRouter } from './routers/api.js'
import { sqsRouter } from './routers/sqs.js'

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter, sqsRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'routers/api.ts',
    code: `import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'
import { createItem } from '../handlers/createItem.js'
import { CreateItemBodySchema, QuerySchema } from '../schemas/item.js'

export const apiRouter = createAPIGatewayRouter()

apiRouter.post({
  path: '/orgs/:orgId/items/:itemId',
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  querySchema: QuerySchema,
})`,
  },
  {
    path: 'routers/sqs.ts',
    code: `import { createSQSRouter } from '@lambda-event-router/sqs'
import { processOrder } from '../handlers/processOrder.js'
import { OrderSchema } from '../schemas/order.js'

export const sqsRouter = createSQSRouter()

sqsRouter.route({
  filters: { eventSourceArns: ['arn:aws:sqs:us-east-1:123456789:orders'] },
  bodySchema: OrderSchema,
  handler: processOrder,
})`,
  },
  {
    path: 'handlers/createItem.ts',
    code: `import type { ApiRequest, ApiResponse } from '@lambda-event-router/apigateway'

type PathParams = { orgId: string; itemId: string }
type QueryParams = { dryRun?: string }
type Body = { name: string; price: number }

interface CreateItemResponse {
  orgId: string
  itemId: string
  name: string
  price: number
}

export async function createItem(
  request: ApiRequest<PathParams, QueryParams, Body>,
): Promise<ApiResponse<CreateItemResponse>> {
  const { orgId, itemId } = request.path
  const { name, price } = request.body

  return {
    statusCode: 201,
    body: { orgId, itemId, name, price },
  }
}`,
  },
  {
    path: 'handlers/processOrder.ts',
    code: `import type { SQSHandlerEvent } from '@lambda-event-router/sqs'

interface Order {
  orderId: string
  product: string
  quantity: number
}

export async function processOrder({ body }: SQSHandlerEvent<Order>) {
  console.log(\`Processing order \${body.orderId}: \${body.quantity}x \${body.product}\`)
}`,
  },
  {
    path: 'schemas/item.ts',
    code: `import { z } from 'zod'

export const CreateItemBodySchema = z.object({
  name: z.string(),
  price: z.number(),
})

export const QuerySchema = z.object({
  dryRun: z.string().default('false'),
})`,
  },
  {
    path: 'schemas/order.ts',
    code: `import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  product: z.string(),
  quantity: z.number().int().positive(),
})`,
  },
  {
    path: 'package.json',
    lang: 'json',
    code: `{
  "name": "my-lambda",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@lambda-event-router/base": "^1.0.0",
    "@lambda-event-router/apigateway": "^1.0.0",
    "@lambda-event-router/sqs": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "@types/aws-lambda": "^8.10.145"
  }
}`,
  },
  {
    path: 'api.js',
    code: `import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'
import { createItem } from '../handlers/createItem.js'
import { CreateItemBodySchema, QuerySchema } from '../schemas/item.js'

export const apiRouter = createAPIGatewayRouter()

apiRouter.post({
  path: '/orgs/:orgId/items/:itemId',
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  querySchema: QuerySchema,
})`,
  },
  {
    path: 'api.html',
    code: `\<!DOCTYPE html>
\<html lang="en">
  \<head>
    \<meta charset="UTF-8">
    \<meta name="viewport" content="width=device-width, initial-scale=1.0">
    \<meta http-equiv="X-UA-Compatible" content="ie=edge">
    \<title>HTML 5 Boilerplate\</title>
    \<link rel="stylesheet" href="style.css">
  \</head>
  \<body>
    \<h1>test</h1>
  \</body>
</html>`,
  },
]
</script>

<CodeFileViewer :files="files" default-file="schemas/item.ts" id="multi-router" line-numbers collapse-toggle fixed-height />
<!-- <CodeFileViewer :files="files" id="multi-router" /> -->

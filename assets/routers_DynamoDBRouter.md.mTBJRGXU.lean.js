import{C as t,o as n,c as h,ak as e,E as r}from"./chunks/framework.Ct7YXsF8.js";const k=JSON.parse('{"title":"DynamoDBRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/DynamoDBRouter.md","filePath":"routers/DynamoDBRouter.md"}'),d={name:"routers/DynamoDBRouter.md"},E=Object.assign(d,{setup(l){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { dynamoRouter } from './dynamodb.js'

const lambdaRouter = new LambdaRouter({
  routers: [dynamoRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"dynamodb.ts",code:`import { createDynamoDBRouter } from '@lambda-event-router/dynamodb'

import { onOrderInserted, onOrderRemoved, onOrderStatusChanged } from './handlers/orders.js'
import { OrderKeysSchema, OrderSchema } from './schemas/order.js'

const ORDER_TABLE_STREAM_ARN =
  'arn:aws:dynamodb:eu-west-2:123456789012:table/orders/stream/2026-01-01T00:00:00.000'

export const dynamoRouter = createDynamoDBRouter({
  batchItemFailures: true,
  keys: { partitionKey: 'pk', sortKey: 'sk' },
})

dynamoRouter
  .insert({
    filters: { eventSourceArn: ORDER_TABLE_STREAM_ARN, partitionKey: 'ORDER#*' },
    keysSchema: OrderKeysSchema,
    newImageSchema: OrderSchema,
    handler: onOrderInserted,
  })
  .modify({
    filters: { eventSourceArn: ORDER_TABLE_STREAM_ARN, partitionKey: 'ORDER#*' },
    keysSchema: OrderKeysSchema,
    newImageSchema: OrderSchema,
    oldImageSchema: OrderSchema,
    handler: onOrderStatusChanged,
  })
  .remove({
    filters: { eventSourceArn: ORDER_TABLE_STREAM_ARN, partitionKey: 'ORDER#*' },
    keysSchema: OrderKeysSchema,
    oldImageSchema: OrderSchema,
    handler: onOrderRemoved,
  })`},{path:"handlers/orders.ts",code:`import { logger } from '@lambda-event-router/base'
import type {
  DynamoDBInsertRequest,
  DynamoDBModifyRequest,
  DynamoDBRemoveRequest,
  DynamoDBResponse,
} from '@lambda-event-router/dynamodb'

import type { Order, OrderKeys } from '../schemas/order.js'

export async function onOrderInserted(
  request: DynamoDBInsertRequest<OrderKeys, Order>,
): Promise<DynamoDBResponse> {
  logger.info(\`Order created \${request.newImage.orderId}\`)
}

export async function onOrderStatusChanged(
  request: DynamoDBModifyRequest<OrderKeys, Order, Order>,
): Promise<DynamoDBResponse> {
  const { newImage, oldImage } = request
  if (newImage.status === oldImage.status) return

  logger.info(\`Order \${newImage.orderId} moved to \${newImage.status}\`)
}

export async function onOrderRemoved(
  request: DynamoDBRemoveRequest<OrderKeys, Order>,
): Promise<DynamoDBResponse> {
  logger.info(\`Order deleted \${request.oldImage.orderId}\`)
}`},{path:"schemas/order.ts",code:`import { z } from 'zod'

export const OrderKeysSchema = z.object({
  pk: z.string(),
  sk: z.string(),
})

export const OrderSchema = z.object({
  orderId: z.string(),
  status: z.enum(['pending', 'confirmed', 'shipped']),
  total: z.number(),
})

export type OrderKeys = z.infer<typeof OrderKeysSchema>
export type Order = z.infer<typeof OrderSchema>`}];return(o,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",85)),r(a,{files:i,id:"dynamodb-example","default-file":"dynamodb.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",3))])}}});export{k as __pageData,E as default};

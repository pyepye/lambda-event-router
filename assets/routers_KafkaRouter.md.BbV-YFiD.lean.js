import{C as t,o as n,c as h,ak as a,E as r}from"./chunks/framework.Ct7YXsF8.js";const o=JSON.parse('{"title":"KafkaRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/KafkaRouter.md","filePath":"routers/KafkaRouter.md"}'),l={name:"routers/KafkaRouter.md"},c=Object.assign(l,{setup(k){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { kafkaRouter } from './kafka.js'

const lambdaRouter = new LambdaRouter({
  routers: [kafkaRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"kafka.ts",code:`import { createKafkaRouter } from '@lambda-event-router/kafka'

import { onStockAlert, onStockMoved } from './handlers/stock.js'
import { StockAlertSchema, StockMovementSchema } from './schemas/stock.js'

const MSK_CLUSTER_ARN = 'arn:aws:kafka:eu-west-2:123456789012:cluster/warehouse/abc-123-4'

const STOCK_TOPIC = 'stock-movements'
const ALERT_TOPIC = 'stock-alerts'

export const kafkaRouter = createKafkaRouter({ batchItemFailures: true })

kafkaRouter
  .route({
    filters: { topic: STOCK_TOPIC, eventSourceArn: MSK_CLUSTER_ARN },
    valueSchema: StockMovementSchema,
    handler: onStockMoved,
  })
  .route({
    filters: { topic: ALERT_TOPIC, eventSourceArn: MSK_CLUSTER_ARN },
    valueSchema: StockAlertSchema,
    handler: onStockAlert,
  })`},{path:"handlers/stock.ts",code:`import { logger } from '@lambda-event-router/base'
import type { KafkaRequest, KafkaResponse } from '@lambda-event-router/kafka'

import type { StockAlert, StockMovement } from '../schemas/stock.js'

export async function onStockMoved(
  request: KafkaRequest<StockMovement>,
): Promise<KafkaResponse> {
  const { sku, quantity, warehouse } = request.value
  logger.info(\`Moved \${quantity} of \${sku} in \${warehouse} at offset \${request.offset}\`)
}

export async function onStockAlert(request: KafkaRequest<StockAlert>): Promise<KafkaResponse> {
  const { sku, remaining, threshold } = request.value
  if (remaining > threshold) return

  logger.info(\`Stock of \${sku} is down to \${remaining}, below its threshold of \${threshold}\`)
}`},{path:"schemas/stock.ts",code:`import { z } from 'zod'

export const StockMovementSchema = z.object({
  sku: z.string(),
  quantity: z.coerce.number(),
  warehouse: z.string(),
  movedAt: z.coerce.date(),
})

export const StockAlertSchema = z.object({
  sku: z.string(),
  remaining: z.coerce.number(),
  threshold: z.coerce.number(),
})

export type StockMovement = z.infer<typeof StockMovementSchema>
export type StockAlert = z.infer<typeof StockAlertSchema>`}];return(d,s)=>{const e=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=a("",86)),r(e,{files:i,id:"kafka-example","default-file":"kafka.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=a("",3))])}}});export{o as __pageData,c as default};

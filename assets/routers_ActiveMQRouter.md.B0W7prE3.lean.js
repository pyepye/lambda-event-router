import{C as t,o as n,c as h,ak as e,E as r}from"./chunks/framework.Ct7YXsF8.js";const k=JSON.parse('{"title":"ActiveMQRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/ActiveMQRouter.md","filePath":"routers/ActiveMQRouter.md"}'),d={name:"routers/ActiveMQRouter.md"},c=Object.assign(d,{setup(l){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { activeMQRouter } from './activemq.js'

const lambdaRouter = new LambdaRouter({
  routers: [activeMQRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"activemq.ts",code:`import { createActiveMQRouter } from '@lambda-event-router/mq'

import { onUnknownMessage, processOrder, storeScan } from './handlers/orders.js'
import { OrderSchema } from './schemas/order.js'

const BROKER_ARN = 'arn:aws:mq:eu-west-2:123456789012:broker:trading:b-1234'

export const activeMQRouter = createActiveMQRouter()

activeMQRouter
  .textMessage({
    filters: {
      eventSourceArn: BROKER_ARN,
      destination: 'orders',
    },
    bodySchema: OrderSchema,
    handler: processOrder,
  })
  .bytesMessage({
    filters: {
      eventSourceArn: BROKER_ARN,
      destination: 'scans',
    },
    handler: storeScan,
  })
  .route({
    filters: {},
    handler: onUnknownMessage,
  })`},{path:"handlers/orders.ts",code:`import { logger } from '@lambda-event-router/base'
import type {
  ActiveMQBytesMessageRequest,
  ActiveMQRequest,
  ActiveMQResponse,
  ActiveMQTextMessageRequest,
} from '@lambda-event-router/mq'

import type { Order } from '../schemas/order.js'

export async function processOrder(
  request: ActiveMQTextMessageRequest<Order>,
): Promise<ActiveMQResponse> {
  logger.info(\`Processing order \${request.body.orderId} for \${request.body.total}\`)
}

export async function storeScan(request: ActiveMQBytesMessageRequest): Promise<ActiveMQResponse> {
  // body is a Buffer of the raw bytes
  const scan = request.body

  logger.info(\`Storing a \${scan.byteLength} byte scan from \${request.destination}\`)
}

export async function onUnknownMessage(request: ActiveMQRequest): Promise<ActiveMQResponse> {
  logger.warn(\`Dropping a \${request.messageType} from \${request.destination}\`)
}`},{path:"schemas/order.ts",code:`import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

export type Order = z.infer<typeof OrderSchema>`}];return(o,s)=>{const i=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",89)),r(i,{files:a,id:"activemq-example","default-file":"activemq.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",4))])}}});export{k as __pageData,c as default};

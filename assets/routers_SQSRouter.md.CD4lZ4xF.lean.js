import{C as n,o as h,c as r,ak as l,E as p,j as i,a}from"./chunks/framework.Ct7YXsF8.js";const c=JSON.parse('{"title":"SQSRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/SQSRouter.md","filePath":"routers/SQSRouter.md"}'),d={name:"routers/SQSRouter.md"},g=Object.assign(d,{setup(k){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { sqsRouter } from './sqs.js'

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"sqs.ts",code:`import { createSQSRouter } from '@lambda-event-router/sqs'

import { processOrder, refundOrder } from './handlers/orders.js'
import { OrderSchema } from './schemas/order.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'
const ORDER_DL_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders-dl'

export const sqsRouter = createSQSRouter({ batchItemFailures: true })

sqsRouter
  .route({
    filters: {
      eventSourceArn: [ORDER_QUEUE_ARN, ORDER_DL_QUEUE_ARN],
      messageAttributes: { Type: 'ProcessOrder' },
    },
    bodySchema: OrderSchema,
    handler: processOrder,
  })
  .route({
    filters: {
      eventSourceArn: [ORDER_QUEUE_ARN, ORDER_DL_QUEUE_ARN],
      messageAttributes: { Type: 'RefundOrder' },
    },
    bodySchema: OrderSchema,
    handler: refundOrder,
  })`},{path:"handlers/orders.ts",code:`import { logger } from '@lambda-event-router/base'
import type { SQSRequest, SQSResponse } from '@lambda-event-router/sqs'

import type { Order } from '../schemas/order.js'

export async function processOrder(request: SQSRequest<Order>): Promise<SQSResponse> {
  logger.info(\`Processing order \${request.body.orderId}\`)
}

export async function refundOrder(request: SQSRequest<Order>): Promise<SQSResponse> {
  logger.info(\`Refunding order \${request.body.orderId} for \${request.body.total}\`)
}`},{path:"schemas/order.ts",code:`import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

export type Order = z.infer<typeof OrderSchema>`}];return(o,s)=>{const t=n("CodeFileViewer");return h(),r("div",null,[s[0]||(s[0]=l("",71)),p(t,{files:e,id:"sqs-example","default-file":"sqs.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("p",null,[a("Each route matches a different "),i("code",null,"Type"),a(" attribute, so no message can match both and the order you register them in makes no difference. Both accept the dead letter queue as well as the main one, so a redriven message lands on the same handler it would have the first time.")],-1)),s[2]||(s[2]=i("p",null,[i("code",null,"index.ts"),a(" hands the router to "),i("code",null,"LambdaRouter"),a(", which is what AWS invokes and what every router in the Lambda gets registered on. See "),i("a",{href:"/lambda-event-router/docs/routers"},"routers"),a(" for how the two levels of matching fit together.")],-1))])}}});export{c as __pageData,g as default};

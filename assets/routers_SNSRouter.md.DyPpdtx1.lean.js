import{C as n,o as h,c as r,ak as l,E as d,j as i,a}from"./chunks/framework.DiNuf6zK.js";const E=JSON.parse('{"title":"SNSRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/SNSRouter.md","filePath":"routers/SNSRouter.md"}'),p={name:"routers/SNSRouter.md"},g=Object.assign(p,{setup(k){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { snsRouter } from './sns.js'

const lambdaRouter = new LambdaRouter({
  routers: [snsRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"sns.ts",code:`import { createSNSRouter } from '@lambda-event-router/sns'

import { processOrder, refundOrder } from './handlers/orders.js'
import { OrderSchema } from './schemas/order.js'

const ORDER_TOPIC_ARN = 'arn:aws:sns:eu-west-2:123456789012:orders'

export const snsRouter = createSNSRouter()

snsRouter
  .route({
    filters: {
      topicArn: ORDER_TOPIC_ARN,
      subject: 'Order created',
    },
    bodySchema: OrderSchema,
    handler: processOrder,
  })
  .route({
    filters: {
      topicArn: ORDER_TOPIC_ARN,
      subject: 'Order refunded',
    },
    bodySchema: OrderSchema,
    handler: refundOrder,
  })`},{path:"handlers/orders.ts",code:`import { logger } from '@lambda-event-router/base'
import type { SNSRequest, SNSResponse } from '@lambda-event-router/sns'

import type { Order } from '../schemas/order.js'

export async function processOrder(request: SNSRequest<Order>): Promise<SNSResponse> {
  logger.info(\`Processing order \${request.body.orderId}\`)
}

export async function refundOrder(request: SNSRequest<Order>): Promise<SNSResponse> {
  logger.info(\`Refunding order \${request.body.orderId} for \${request.body.total}\`)
}`},{path:"schemas/order.ts",code:`import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

export type Order = z.infer<typeof OrderSchema>`}];return(o,s)=>{const t=n("CodeFileViewer");return h(),r("div",null,[s[0]||(s[0]=l("",74)),d(t,{files:e,id:"sns-example","default-file":"sns.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("p",null,"Each route matches a different subject, so no notification can match both and the order you register them in makes no difference. Both routes need the publisher to set a subject, so if that is not guaranteed, filter on a message attribute instead.",-1)),s[2]||(s[2]=i("p",null,[i("code",null,"index.ts"),a(" hands the router to "),i("code",null,"LambdaRouter"),a(", which is what AWS invokes and what every router in the Lambda gets registered on. See "),i("a",{href:"/docs/routers"},"routers"),a(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,g as default};

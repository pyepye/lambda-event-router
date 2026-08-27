import{C as n,o as h,c as r,ak as d,E as l,j as e,a}from"./chunks/framework.Ct7YXsF8.js";const E=JSON.parse('{"title":"RabbitMQRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/RabbitMQRouter.md","filePath":"routers/RabbitMQRouter.md"}'),o={name:"routers/RabbitMQRouter.md"},g=Object.assign(o,{setup(p){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { rabbitMQRouter } from './rabbitmq.js'

const lambdaRouter = new LambdaRouter({
  routers: [rabbitMQRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"rabbitmq.ts",code:`import { createRabbitMQRouter } from '@lambda-event-router/mq'

import { onUnknownMessage, processOrder, refundOrder } from './handlers/orders.js'
import { OrderSchema } from './schemas/order.js'

const BROKER_ARN = 'arn:aws:mq:eu-west-2:123456789012:broker:trading:b-1234'

export const rabbitMQRouter = createRabbitMQRouter()

rabbitMQRouter
  .route({
    filters: {
      eventSourceArn: BROKER_ARN,
      queue: 'orders',
      contentType: 'application/json',
    },
    bodySchema: OrderSchema,
    handler: processOrder,
  })
  .route({
    filters: {
      eventSourceArn: BROKER_ARN,
      queue: 'refunds',
      contentType: 'application/json',
    },
    bodySchema: OrderSchema,
    handler: refundOrder,
  })
  .route({
    filters: {},
    handler: onUnknownMessage,
  })`},{path:"handlers/orders.ts",code:`import { logger } from '@lambda-event-router/base'
import type { RabbitMQRequest, RabbitMQResponse } from '@lambda-event-router/mq'

import type { Order } from '../schemas/order.js'

export async function processOrder(request: RabbitMQRequest<Order>): Promise<RabbitMQResponse> {
  logger.info(\`Processing order \${request.body.orderId}\`)
}

export async function refundOrder(request: RabbitMQRequest<Order>): Promise<RabbitMQResponse> {
  logger.info(\`Refunding order \${request.body.orderId} for \${request.body.total}\`)
}

export async function onUnknownMessage(request: RabbitMQRequest): Promise<RabbitMQResponse> {
  const { contentType } = request.message.basicProperties

  logger.warn(\`Dropping a \${contentType} message from \${request.queue}\`)
}`},{path:"schemas/order.ts",code:`import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

export type Order = z.infer<typeof OrderSchema>`}];return(k,s)=>{const t=n("CodeFileViewer");return h(),r("div",null,[s[0]||(s[0]=d("",78)),l(t,{files:i,id:"rabbitmq-example","default-file":"rabbitmq.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("p",null,"The first two routes match a different queue, so no message can match both and the order they are registered in makes no difference to them.",-1)),s[2]||(s[2]=e("p",null,[a("The catch-all is the one route that cares where it sits, since empty filters match anything. Register it last and it takes what the other two turned down, which here is a plain text message on "),e("code",null,"orders"),a(" as much as anything from a third queue. Without it those throw, and a throw takes the rest of the batch with it.")],-1)),s[3]||(s[3]=e("p",null,[e("code",null,"index.ts"),a(" hands the router to "),e("code",null,"LambdaRouter"),a(", which is what AWS invokes and what every router in the Lambda gets registered on. See "),e("a",{href:"/lambda-event-router/docs/routers"},"routers"),a(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,g as default};

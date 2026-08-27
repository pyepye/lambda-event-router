import{C as n,o as h,c as d,ak as l,E as r,j as e,a as i}from"./chunks/framework.Ct7YXsF8.js";const E=JSON.parse('{"title":"EventBridgeRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/EventBridgeRouter.md","filePath":"routers/EventBridgeRouter.md"}'),p={name:"routers/EventBridgeRouter.md"},g=Object.assign(p,{setup(o){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { eventBridgeRouter } from './eventbridge.js'

const lambdaRouter = new LambdaRouter({
  routers: [eventBridgeRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"eventbridge.ts",code:`import { createEventBridgeRouter } from '@lambda-event-router/eventbridge'

import { handleEc2StateChange, handleScheduledRule, processOrder } from './handlers/events.js'
import { OrderSchema } from './schemas/order.js'

export const eventBridgeRouter = createEventBridgeRouter()

eventBridgeRouter
  .route({
    filters: { source: 'myapp.orders', detailType: 'Order Created' },
    detailSchema: OrderSchema,
    handler: processOrder,
  })
  .route({
    filters: { source: 'aws.ec2', detailType: 'EC2 Instance State-change Notification' },
    handler: handleEc2StateChange,
  })
  .route({
    filters: { source: 'aws.events', detailType: 'Scheduled Event' },
    handler: handleScheduledRule,
  })`},{path:"handlers/events.ts",code:`import { logger } from '@lambda-event-router/base'
import type { EC2StateChangeDetail, EventBridgeRequest, ScheduledEventDetail } from '@lambda-event-router/eventbridge'

import type { Order } from '../schemas/order.js'

export async function processOrder({ detail }: EventBridgeRequest<Order>): Promise<void> {
  logger.info(\`Processing order \${detail.orderId} for \${detail.total}\`)
}

export async function handleEc2StateChange({ detail }: EventBridgeRequest<EC2StateChangeDetail>): Promise<void> {
  logger.info(\`Instance \${detail['instance-id']} is now \${detail.state}\`)
}

export async function handleScheduledRule({ time, resources }: EventBridgeRequest<ScheduledEventDetail>): Promise<void> {
  logger.info(\`Scheduled rule \${resources[0]} fired at \${time}\`)
}`},{path:"schemas/order.ts",code:`import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  total: z.number(),
})

export type Order = z.infer<typeof OrderSchema>`}];return(k,s)=>{const t=n("CodeFileViewer");return h(),d("div",null,[s[0]||(s[0]=l("",80)),r(t,{files:a,id:"eventbridge-example","default-file":"eventbridge.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("p",null,[i("Each route matches a different source and detail type, so no event can match two and the order you register them in makes no difference. The EC2 and scheduled routes need no schema, since their detail is typed from the "),e("a",{href:"#typed-detail"},"detail map"),i(".")],-1)),s[2]||(s[2]=e("p",null,[e("code",null,"index.ts"),i(" hands the router to "),e("code",null,"LambdaRouter"),i(", which is what AWS invokes and what every router in the Lambda gets registered on. See "),e("a",{href:"/lambda-event-router/docs/routers"},"routers"),i(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,g as default};

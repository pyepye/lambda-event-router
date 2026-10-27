import{C as n,o as h,c as d,ak as l,E as r,j as e,a as i}from"./chunks/framework.C2AAou88.js";const E=JSON.parse('{"title":"EventBridgeMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/EventBridgeMatcher.md","filePath":"matchers/EventBridgeMatcher.md"}'),p={name:"matchers/EventBridgeMatcher.md"},g=Object.assign(p,{setup(k){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { eventBridgeMatcher } from './eventbridge.js'

const latcher = new Latcher({
  matchers: [eventBridgeMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"eventbridge.ts",code:`import { createEventBridgeMatcher } from '@latcher/eventbridge'

import { handleEc2StateChange, handleScheduledRule, processOrder } from './handlers/events.js'
import { OrderSchema } from './schemas/order.js'

export const eventBridgeMatcher = createEventBridgeMatcher()

eventBridgeMatcher
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
  })`},{path:"handlers/events.ts",code:`import { logger } from '@latcher/base'
import type { EC2StateChangeDetail, EventBridgeRequest, ScheduledEventDetail } from '@latcher/eventbridge'

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

export type Order = z.infer<typeof OrderSchema>`}];return(o,s)=>{const t=n("CodeFileViewer");return h(),d("div",null,[s[0]||(s[0]=l("",81)),r(t,{files:a,id:"eventbridge-example","default-file":"eventbridge.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("p",null,[i("Each route matches a different source and detail type, so no event can match two and the order you register them in makes no difference. The EC2 and scheduled routes need no schema, since their detail is typed from the "),e("a",{href:"#typed-detail"},"detail map"),i(".")],-1)),s[2]||(s[2]=e("p",null,[e("code",null,"index.ts"),i(" hands the matcher to "),e("code",null,"Latcher"),i(", which is what AWS invokes and what every matcher in the Lambda gets registered on. See "),e("a",{href:"/latcher/docs/matchers"},"matchers"),i(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,g as default};

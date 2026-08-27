import{C as p,o as k,c as d,ak as i,E as h}from"./chunks/framework.DiNuf6zK.js";const y=JSON.parse('{"title":"Handlers","description":"","frontmatter":{},"headers":[],"relativePath":"docs/handlers.md","filePath":"docs/handlers.md"}'),o={name:"docs/handlers.md"},u=Object.assign(o,{setup(E){const a=`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { sqsRouter } from './sqs.js'

const lambdaRouter = new LambdaRouter({
  routers: [sqsRouter],
})

export const handler: Handler = lambdaRouter.handler()`,e=`import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  customerEmail: z.string(),
  items: z.array(z.object({ sku: z.string(), price: z.number(), quantity: z.number() })),
})

export const OrderAttributesSchema = z.object({ dryRun: z.coerce.boolean().default(false) })`,t=`  const total = body.items.reduce((sum, { price, quantity }) => sum + price * quantity, 0)

  if (messageAttributes.dryRun) {
    logger.info('Dry run, order not saved', { orderId: body.orderId, total })
    return
  }

  await orders.save({ ...body, total, status: 'CONFIRMED' })
  await notifications.send(body.customerEmail, 'order-confirmed', { total })`,l=[{path:"routes/processOrder.ts",code:`import { defineRoute } from '@lambda-event-router/sqs'

import { OrderAttributesSchema, OrderSchema } from '../schemas/order.js'
import { notifications, orders } from '../services/orders.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const processOrderRoute = defineRoute({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  bodySchema: OrderSchema,
  messageAttributesSchema: OrderAttributesSchema,
}).handle(async ({ body, messageAttributes }) => {
  // No types named anywhere. defineRoute infers the request from the two schemas
${t}
})`},{path:"schemas/order.ts",code:e},{path:"sqs.ts",code:`import { createSQSRouter } from '@lambda-event-router/sqs'

import { processOrderRoute } from './routes/processOrder.js'

export const sqsRouter = createSQSRouter()

// The route arrives complete, filters and schemas included
sqsRouter.route(processOrderRoute)`},{path:"index.ts",code:a}],r=[{path:"handlers/processOrder.ts",code:`import type { SQSMessageAttributes, SQSRequest, SQSResponse } from '@lambda-event-router/sqs'
import type { z } from 'zod'

import { OrderAttributesSchema, OrderSchema } from '../schemas/order.js'
import { notifications, orders } from '../services/orders.js'

// The types defineRoute would have inferred, named here instead
type Order = z.infer<typeof OrderSchema>
type OrderAttributes = z.infer<typeof OrderAttributesSchema> & SQSMessageAttributes

export async function processOrder(request: SQSRequest<Order, OrderAttributes>): Promise<SQSResponse> {
  const { body, messageAttributes } = request
${t}
}`},{path:"schemas/order.ts",code:e},{path:"sqs.ts",code:`import { createSQSRouter } from '@lambda-event-router/sqs'

import { processOrder } from './handlers/processOrder.js'
import { OrderAttributesSchema, OrderSchema } from './schemas/order.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const sqsRouter = createSQSRouter()

// Filters, schemas and handler are brought together here instead
sqsRouter.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  bodySchema: OrderSchema,
  messageAttributesSchema: OrderAttributesSchema,
  handler: processOrder,
})`},{path:"index.ts",code:a}];return(g,s)=>{const n=p("CodeFileViewer");return k(),d("div",null,[s[0]||(s[0]=i("",34)),h(n,{files:l,id:"inferred-handlers","default-file":"routes/processOrder.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("",5)),h(n,{files:r,id:"annotated-handlers","default-file":"handlers/processOrder.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[2]||(s[2]=i("",4))])}}});export{y as __pageData,u as default};

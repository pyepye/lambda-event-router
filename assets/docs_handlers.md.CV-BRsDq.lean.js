import{C as d,o,c as E,ak as l,E as r,j as i,a}from"./chunks/framework.C2AAou88.js";const F=JSON.parse('{"title":"Handlers","description":"","frontmatter":{},"headers":[],"relativePath":"docs/handlers.md","filePath":"docs/handlers.md"}'),g={name:"docs/handlers.md"},m=Object.assign(g,{setup(c){const e=`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { sqsMatcher } from './sqs.js'

const latcher = new Latcher({
  matchers: [sqsMatcher],
})

export const handler: Handler = latcher.handler()`,t=`import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  customerEmail: z.string(),
  items: z.array(z.object({ sku: z.string(), price: z.number(), quantity: z.number() })),
})

export const OrderAttributesSchema = z.object({ dryRun: z.coerce.boolean().default(false) })`,n=`  const total = body.items.reduce((sum, { price, quantity }) => sum + price * quantity, 0)

  if (messageAttributes.dryRun) {
    logger.info('Dry run, order not saved', { orderId: body.orderId, total })
    return
  }

  await orders.save({ ...body, total, status: 'CONFIRMED' })
  await notifications.send(body.customerEmail, 'order-confirmed', { total })`,p=[{path:"routes/processOrder.ts",code:`import { logger } from '@latcher/base'
import { defineRoute } from '@latcher/sqs'

import { OrderAttributesSchema, OrderSchema } from '../schemas/order.js'
import { notifications, orders } from '../services/orders.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const processOrderRoute = defineRoute({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  bodySchema: OrderSchema,
  messageAttributesSchema: OrderAttributesSchema,
}).handle(async ({ body, messageAttributes }) => {
  // No types named anywhere. defineRoute infers the request from the two schemas
${n}
})`},{path:"schemas/order.ts",code:t},{path:"sqs.ts",code:`import { createSQSMatcher } from '@latcher/sqs'

import { processOrderRoute } from './routes/processOrder.js'

export const sqsMatcher = createSQSMatcher()

// The route arrives complete, filters and schemas included
sqsMatcher.route(processOrderRoute)`},{path:"index.ts",code:e}],k=[{path:"handlers/processOrder.ts",code:`import { logger } from '@latcher/base'
import type { SQSRequest, SQSResponse } from '@latcher/sqs'
import type { z } from 'zod'

import { OrderAttributesSchema, OrderSchema } from '../schemas/order.js'
import { notifications, orders } from '../services/orders.js'

// The types defineRoute would have inferred, named here instead
type Order = z.infer<typeof OrderSchema>
type OrderAttributes = z.infer<typeof OrderAttributesSchema>

export async function processOrder(request: SQSRequest<Order, OrderAttributes>): Promise<SQSResponse> {
  const { body, messageAttributes } = request
${n}
}`},{path:"schemas/order.ts",code:t},{path:"sqs.ts",code:`import { createSQSMatcher } from '@latcher/sqs'

import { processOrder } from './handlers/processOrder.js'
import { OrderAttributesSchema, OrderSchema } from './schemas/order.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const sqsMatcher = createSQSMatcher()

// Filters, schemas and handler are brought together here instead
sqsMatcher.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  bodySchema: OrderSchema,
  messageAttributesSchema: OrderAttributesSchema,
  handler: processOrder,
})`},{path:"index.ts",code:e}];return(y,s)=>{const h=d("CodeFileViewer");return o(),E("div",null,[s[0]||(s[0]=l("",34)),r(h,{files:p,id:"inferred-handlers","default-file":"routes/processOrder.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=l("",5)),r(h,{files:k,id:"annotated-handlers","default-file":"handlers/processOrder.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[2]||(s[2]=i("p",null,[a("Same four files, same schemas, same handler body. Both differ in one thing only, which is that "),i("code",null,"SQSRequest<Order, OrderAttributes>"),a(" names what "),i("code",null,"defineRoute"),a(" worked out for itself.")],-1)),s[3]||(s[3]=i("p",null,[a("Derive those types from the schema with "),i("code",null,"z.infer"),a(" rather than writing an interface that mirrors it, so the two cannot drift.")],-1)),s[4]||(s[4]=i("p",null,[a("Most matchers take the payload first and its attributes second, the way "),i("code",null,"SQSRequest<TBody, TMessageAttributes>"),a(" does, and later parameters have defaults so passing only the first leaves the rest alone. Each matcher page lists its own parameters in order.")],-1))])}}});export{F as __pageData,m as default};

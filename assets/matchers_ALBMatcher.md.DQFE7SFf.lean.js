import{C as i,o as n,c as d,ak as e,E as h}from"./chunks/framework.C2AAou88.js";const k=JSON.parse('{"title":"ALBMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/ALBMatcher.md","filePath":"matchers/ALBMatcher.md"}'),r={name:"matchers/ALBMatcher.md"},c=Object.assign(r,{setup(o){const t=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { albMatcher } from './alb.js'

const latcher = new Latcher({
  matchers: [albMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"alb.ts",code:`import { createALBMatcher } from '@latcher/alb'

import { requireOidcIdentity } from './middleware/requireOidcIdentity.js'
import { createOrder, getOrder, listOrders } from './handlers/orders.js'
import { ListOrdersQuerySchema, NewOrderSchema, OrderSchema } from './schemas/order.js'

export const albMatcher = createALBMatcher({ middleware: [requireOidcIdentity] })

albMatcher
  .get({
    filters: { path: '/orgs/:orgId/orders' },
    querySchema: ListOrdersQuerySchema,
    handler: listOrders,
  })
  .get({
    filters: { path: '/orgs/:orgId/orders/:orderId' },
    responseSchema: OrderSchema,
    handler: getOrder,
  })
  .post({
    filters: { path: '/orgs/:orgId/orders' },
    bodySchema: NewOrderSchema,
    responseSchema: OrderSchema,
    handler: createOrder,
  })`},{path:"middleware/requireOidcIdentity.ts",code:`import { Unauthorized } from '@latcher/alb'
import { logger } from '@latcher/base'
import type { HTTPMiddleware } from '@latcher/alb'

// The load balancer sets this once an authenticate-oidc rule has run
export const requireOidcIdentity: HTTPMiddleware = async (request, next) => {
  const identity = request.headers['x-amzn-oidc-identity']
  if (!identity) {
    logger.warn(\`Rejected a \${request.method} with no OIDC identity header\`)
    throw Unauthorized()
  }

  // Verify x-amzn-oidc-data before authorising on any claim it carries
  logger.appendKeys({ identity })

  return next(request)
}`},{path:"handlers/orders.ts",code:`import type { ApiRequest, HandlerResponse } from '@latcher/alb'
import { Created, NotFound, Ok } from '@latcher/alb'
import { logger } from '@latcher/base'

import { orders } from '../orders.js'
import type { ListOrdersQuery, NewOrder, Order } from '../schemas/order.js'

type OrgPath = { orgId: string }
type OrderPath = { orgId: string; orderId: string }

export async function listOrders(
  request: ApiRequest<OrgPath, ListOrdersQuery>,
): Promise<HandlerResponse<Order[]>> {
  const { orgId } = request.path
  // The schema marks status optional with no default, so the handler picks one when it is absent
  const status = request.query.status ?? 'OPEN'

  return Ok(await orders.list(orgId, status))
}

export async function getOrder(request: ApiRequest<OrderPath>): Promise<HandlerResponse<Order>> {
  const { orgId, orderId } = request.path

  const order = await orders.get(orgId, orderId)
  if (!order) {
    throw NotFound(\`Order \${orderId} not found\`)
  }

  return Ok(order)
}

export async function createOrder(
  request: ApiRequest<OrgPath, Record<string, string | undefined>, undefined, NewOrder>,
): Promise<HandlerResponse<Order>> {
  const { orgId } = request.path
  const { sku, quantity } = request.body

  const order = await orders.create(orgId, sku, quantity)
  logger.info(\`Created order \${order.orderId} for org \${orgId}\`)

  return Created(order)
}`},{path:"schemas/order.ts",code:`import { z } from 'zod'

export const OrderStatusSchema = z.union([z.literal('OPEN'), z.literal('SHIPPED')])

export const OrderSchema = z.object({
  orderId: z.string(),
  sku: z.string(),
  quantity: z.number(),
  status: OrderStatusSchema,
})

export const NewOrderSchema = OrderSchema.pick({ sku: true, quantity: true })

export const ListOrdersQuerySchema = z.object({
  status: OrderStatusSchema.optional(),
})

export type Order = z.infer<typeof OrderSchema>
export type NewOrder = z.infer<typeof NewOrderSchema>
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>`}];return(l,s)=>{const a=i("CodeFileViewer");return n(),d("div",null,[s[0]||(s[0]=e("",190)),h(a,{files:t,id:"alb-example","default-file":"alb.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",4))])}}});export{k as __pageData,c as default};

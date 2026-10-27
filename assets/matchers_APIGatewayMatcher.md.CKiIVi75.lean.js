import{C as i,o as n,c as h,ak as e,E as d}from"./chunks/framework.C2AAou88.js";const k=JSON.parse('{"title":"APIGatewayMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/APIGatewayMatcher.md","filePath":"matchers/APIGatewayMatcher.md"}'),r={name:"matchers/APIGatewayMatcher.md"},c=Object.assign(r,{setup(o){const t=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { apiMatcher } from './api.js'

const latcher = new Latcher({
  matchers: [apiMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"api.ts",code:`import { createAPIGatewayMatcher } from '@latcher/apigateway'

import { createOrder, getOrder, listOrders } from './handlers/orders.js'
import { ListOrdersQuerySchema, NewOrderSchema, OrderSchema } from './schemas/order.js'

export const apiMatcher = createAPIGatewayMatcher()

apiMatcher
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
  })`},{path:"handlers/orders.ts",code:`import type { APIGatewayAuth, ApiRequest, HandlerResponse } from '@latcher/apigateway'
import { Created, NotFound, Ok } from '@latcher/apigateway'
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
  request: ApiRequest<OrgPath, Record<string, string | undefined>, APIGatewayAuth, NewOrder>,
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
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>`}];return(p,s)=>{const a=i("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",231)),d(a,{files:t,id:"apigateway-example","default-file":"api.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",3))])}}});export{k as __pageData,c as default};

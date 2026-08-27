import{C as i,o as n,c as d,ak as e,E as h}from"./chunks/framework.DiNuf6zK.js";const k=JSON.parse('{"title":"VPCLatticeRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/VPCLatticeRouter.md","filePath":"routers/VPCLatticeRouter.md"}'),r={name:"routers/VPCLatticeRouter.md"},c=Object.assign(r,{setup(o){const t=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { latticeRouter } from './vpclattice.js'

const lambdaRouter = new LambdaRouter({
  routers: [latticeRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"vpclattice.ts",code:`import { createVPCLatticeRouter } from '@lambda-event-router/vpclattice'

import { createOrder, getOrder, listOrders } from './handlers/orders.js'
import { ListOrdersQuerySchema, NewOrderSchema, OrderSchema } from './schemas/order.js'

export const latticeRouter = createVPCLatticeRouter()

latticeRouter
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
  })`},{path:"handlers/orders.ts",code:`import { logger } from '@lambda-event-router/base'
import type { ApiRequest, ApiResponse } from '@lambda-event-router/vpclattice'
import { Created, NotFound, Ok } from '@lambda-event-router/vpclattice'

import { orders } from '../orders.js'
import type { ListOrdersQuery, NewOrder, Order } from '../schemas/order.js'

type OrgPath = { orgId: string }
type OrderPath = { orgId: string; orderId: string }

export async function listOrders(
  request: ApiRequest<OrgPath, ListOrdersQuery>,
): Promise<ApiResponse<Order[]>> {
  const { orgId } = request.path
  // The schema marks status optional with no default, so the handler picks one when it is absent
  const status = request.query.status ?? 'OPEN'

  return Ok(await orders.list(orgId, status))
}

export async function getOrder(request: ApiRequest<OrderPath>): Promise<ApiResponse<Order>> {
  const { orgId, orderId } = request.path

  const order = await orders.get(orgId, orderId)
  if (!order) {
    throw NotFound({ error: \`Order \${orderId} not found\` })
  }

  return Ok(order)
}

export async function createOrder(
  request: ApiRequest<OrgPath, Record<string, string | undefined>, NewOrder>,
): Promise<ApiResponse<Order>> {
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
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>`}];return(p,s)=>{const a=i("CodeFileViewer");return n(),d("div",null,[s[0]||(s[0]=e("",156)),h(a,{files:t,id:"lattice-example","default-file":"vpclattice.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",3))])}}});export{k as __pageData,c as default};

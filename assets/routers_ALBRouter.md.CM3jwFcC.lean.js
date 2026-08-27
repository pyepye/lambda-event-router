import{C as i,o as n,c as h,ak as e,E as d}from"./chunks/framework.DiNuf6zK.js";const k=JSON.parse('{"title":"ALBRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/ALBRouter.md","filePath":"routers/ALBRouter.md"}'),r={name:"routers/ALBRouter.md"},c=Object.assign(r,{setup(o){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { albRouter } from './alb.js'

const lambdaRouter = new LambdaRouter({
  routers: [albRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"alb.ts",code:`import { createALBRouter } from '@lambda-event-router/alb'

import { requireOidcIdentity } from './middleware/requireOidcIdentity.js'
import { createOrder, getOrder, listOrders } from './handlers/orders.js'
import { ListOrdersQuerySchema, NewOrderSchema, OrderSchema } from './schemas/order.js'

export const albRouter = createALBRouter({ middleware: [requireOidcIdentity] })

albRouter
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
  })`},{path:"middleware/requireOidcIdentity.ts",code:`import { Unauthorised } from '@lambda-event-router/alb'
import { logger } from '@lambda-event-router/base'
import type { HTTPMiddleware } from '@lambda-event-router/alb'

// The load balancer sets this once an authenticate-oidc rule has run
export const requireOidcIdentity: HTTPMiddleware = async (request, next) => {
  const identity = request.headers['x-amzn-oidc-identity']
  if (!identity) {
    logger.warn(\`Rejected a \${request.method} with no OIDC identity header\`)
    throw Unauthorised()
  }

  // Verify x-amzn-oidc-data before authorising on any claim it carries
  logger.appendKeys({ identity })

  return next(request)
}`},{path:"handlers/orders.ts",code:`import type { ApiRequest, HandlerResponse } from '@lambda-event-router/alb'
import { Created, NotFound, Ok } from '@lambda-event-router/alb'
import { logger } from '@lambda-event-router/base'

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
    throw NotFound({ error: \`Order \${orderId} not found\` })
  }

  return Ok(order)
}

export async function createOrder(
  request: ApiRequest<OrgPath, Record<string, string | undefined>, NewOrder>,
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
export type ListOrdersQuery = z.infer<typeof ListOrdersQuerySchema>`}];return(l,s)=>{const t=i("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",147)),d(t,{files:a,id:"alb-example","default-file":"alb.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",4))])}}});export{k as __pageData,c as default};

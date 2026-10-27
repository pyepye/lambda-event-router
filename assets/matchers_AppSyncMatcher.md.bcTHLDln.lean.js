import{C as t,o as n,c as h,ak as i,E as r}from"./chunks/framework.C2AAou88.js";const o=JSON.parse('{"title":"AppSyncMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/AppSyncMatcher.md","filePath":"matchers/AppSyncMatcher.md"}'),l={name:"matchers/AppSyncMatcher.md"},c=Object.assign(l,{setup(p){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { appSyncMatcher } from './appsync.js'

const latcher = new Latcher({
  matchers: [appSyncMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"appsync.ts",code:`import { createAppSyncMatcher } from '@latcher/appsync'

import { createOrder, getOrder, getOrderLines, listOrders } from './handlers/orders.js'
import { CreateOrderSchema, GetOrderSchema } from './schemas/order.js'

export const appSyncMatcher = createAppSyncMatcher()

appSyncMatcher
  .query({
    fieldName: 'getOrder',
    argumentsSchema: GetOrderSchema,
    handler: getOrder,
  })
  .query({
    fieldName: 'listOrders',
    handler: listOrders,
  })
  .mutation({
    fieldName: 'createOrder',
    argumentsSchema: CreateOrderSchema,
    handler: createOrder,
  })
  .route({
    filters: { parentTypeName: 'Order', fieldName: 'lines' },
    handler: getOrderLines,
  })`},{path:"handlers/orders.ts",code:`import type { AppSyncResolverRequest } from '@latcher/appsync'
import { logger } from '@latcher/base'

import type { CreateOrderArgs, GetOrderArgs } from '../schemas/order.js'

interface Order {
  id: string
  sku: string
  quantity: number
}

interface OrderLine {
  sku: string
  quantity: number
}

export async function getOrder({
  arguments: args,
}: AppSyncResolverRequest<GetOrderArgs>): Promise<Order> {
  logger.info(\`Resolving order \${args.id}\`)

  // e.g. read the order from DynamoDB
  return { id: args.id, sku: 'SKU-1', quantity: 2 }
}

export async function listOrders({ identity }: AppSyncResolverRequest): Promise<Order[]> {
  // The authorizer put the tenant on the caller's claims
  const tenantId = identity && 'claims' in identity ? identity.claims?.tenantId : undefined
  logger.info(\`Listing orders for tenant \${tenantId}\`)

  return [{ id: 'order-1', sku: 'SKU-1', quantity: 2 }]
}

export async function createOrder({
  arguments: args,
}: AppSyncResolverRequest<CreateOrderArgs>): Promise<Order> {
  const { sku, quantity } = args.input
  logger.info(\`Creating \${quantity} of \${sku}\`)

  return { id: 'order-2', sku, quantity }
}

// Resolves Order.lines, so the order itself arrives on source rather than in the arguments
export async function getOrderLines({ source }: AppSyncResolverRequest): Promise<OrderLine[]> {
  const orderId = source?.id
  if (typeof orderId !== 'string') return []

  logger.info(\`Resolving the lines of order \${orderId}\`)

  return [{ sku: 'SKU-1', quantity: 2 }]
}`},{path:"schemas/order.ts",code:`import { z } from 'zod'

export const GetOrderSchema = z.object({
  id: z.string(),
})

export const CreateOrderSchema = z.object({
  input: z.object({
    sku: z.string(),
    quantity: z.coerce.number().int().positive().default(1),
  }),
})

export type GetOrderArgs = z.infer<typeof GetOrderSchema>
export type CreateOrderArgs = z.infer<typeof CreateOrderSchema>`}];return(d,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=i("",101)),r(a,{files:e,id:"appsync-example","default-file":"appsync.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("",3))])}}});export{o as __pageData,c as default};

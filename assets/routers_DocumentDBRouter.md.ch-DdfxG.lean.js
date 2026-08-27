import{C as a,o as n,c as h,ak as s,E as d}from"./chunks/framework.DiNuf6zK.js";const k=JSON.parse('{"title":"DocumentDBRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/DocumentDBRouter.md","filePath":"routers/DocumentDBRouter.md"}'),l={name:"routers/DocumentDBRouter.md"},c=Object.assign(l,{setup(r){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { documentDBRouter } from './documentdb.js'

const lambdaRouter = new LambdaRouter({
  routers: [documentDBRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"documentdb.ts",code:`import { createDocumentDBRouter } from '@lambda-event-router/documentdb'

import { onOrderDeleted, onOrderInserted, onOrderReplaced, onOrderUpdated } from './handlers/orders.js'
import { OrderDocumentKeySchema, OrderSchema } from './schemas/order.js'

const CLUSTER_ARN = 'arn:aws:rds:eu-west-2:123456789012:cluster:orders-docdb'
const ORDERS = { eventSourceArn: CLUSTER_ARN, database: 'ecommerce', collection: 'orders' }

export const documentDBRouter = createDocumentDBRouter()

documentDBRouter
  .insert({
    filters: ORDERS,
    documentKeySchema: OrderDocumentKeySchema,
    fullDocumentSchema: OrderSchema,
    handler: onOrderInserted,
  })
  .update({
    // The change stream is opened with fullDocument: 'updateLookup', so the document arrives too
    filters: { ...ORDERS, fullDocument: 'updateLookup' },
    documentKeySchema: OrderDocumentKeySchema,
    fullDocumentSchema: OrderSchema,
    handler: onOrderUpdated,
  })
  .replace({
    filters: ORDERS,
    documentKeySchema: OrderDocumentKeySchema,
    fullDocumentSchema: OrderSchema,
    handler: onOrderReplaced,
  })
  .delete({
    filters: ORDERS,
    documentKeySchema: OrderDocumentKeySchema,
    handler: onOrderDeleted,
  })`},{path:"handlers/orders.ts",code:`import { logger } from '@lambda-event-router/base'
import type {
  DocumentDBDeleteRequest,
  DocumentDBInsertRequest,
  DocumentDBReplaceRequest,
  DocumentDBResponse,
  DocumentDBUpdateRequest,
} from '@lambda-event-router/documentdb'

import type { Order, OrderDocumentKey } from '../schemas/order.js'

export async function onOrderInserted(
  request: DocumentDBInsertRequest<OrderDocumentKey, Order>,
): Promise<DocumentDBResponse> {
  logger.info(\`Order created \${request.fullDocument._id} at \${request.fullDocument.total}\`)
}

export async function onOrderUpdated(
  request: DocumentDBUpdateRequest<OrderDocumentKey, Order>,
): Promise<DocumentDBResponse> {
  const { documentKey, fullDocument, updateDescription } = request
  const changed = Object.keys(updateDescription.updatedFields ?? {})
  logger.info(\`Order \${documentKey._id} changed \${changed.join(', ')}\`)

  if (fullDocument) {
    logger.info(\`Order \${documentKey._id} is now \${fullDocument.status}\`)
  }
}

export async function onOrderReplaced(
  request: DocumentDBReplaceRequest<OrderDocumentKey, Order>,
): Promise<DocumentDBResponse> {
  logger.info(\`Order replaced \${request.fullDocument._id}\`)
}

export async function onOrderDeleted(
  request: DocumentDBDeleteRequest<OrderDocumentKey>,
): Promise<DocumentDBResponse> {
  logger.info(\`Order deleted \${request.documentKey._id}\`)
}`},{path:"schemas/order.ts",code:`import { z } from 'zod'

export const OrderDocumentKeySchema = z.object({
  _id: z.string(),
})

export const OrderSchema = z.object({
  _id: z.string(),
  customerId: z.string(),
  status: z.enum(['pending', 'confirmed', 'shipped']),
  total: z.number(),
})

export type OrderDocumentKey = z.infer<typeof OrderDocumentKeySchema>
export type Order = z.infer<typeof OrderSchema>`}];return(o,e)=>{const t=a("CodeFileViewer");return n(),h("div",null,[e[0]||(e[0]=s("",87)),d(t,{files:i,id:"documentdb-example","default-file":"documentdb.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),e[1]||(e[1]=s("",3))])}}});export{k as __pageData,c as default};

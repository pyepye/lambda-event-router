import{C as i,o as n,c as r,ak as s,E as h}from"./chunks/framework.DiNuf6zK.js";const k=JSON.parse('{"title":"Quick start","description":"","frontmatter":{},"headers":[],"relativePath":"docs/quick-start.md","filePath":"docs/quick-start.md"}'),o={name:"docs/quick-start.md"},c=Object.assign(o,{setup(l){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { apiRouter } from './api.js'
import { dynamoRouter } from './dynamodb.js'

// Two event sources, one entry point
const lambdaRouter = new LambdaRouter({ routers: [apiRouter, dynamoRouter] })

export const handler: Handler = lambdaRouter.handler()`},{path:"api.ts",code:`import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'

import { putItem } from './api-handlers/putItem.js'
import { ItemSchema } from './schemas/item.js'

export const apiRouter = createAPIGatewayRouter()

apiRouter.route({
  filters: { method: 'PUT', path: '/items/:itemId' },
  bodySchema: ItemSchema,
  handler: putItem,
})`},{path:"dynamodb.ts",code:`import { createDynamoDBRouter } from '@lambda-event-router/dynamodb'

import { onItemInserted } from './db-handlers/onItemInserted.js'
import { ItemKeysSchema, ItemSchema } from './schemas/item.js'

const ITEM_STREAM_ARN = 'arn:aws:dynamodb:eu-west-2:123456789012:table/items/stream/2026-01-01T00:00:00.000'

export const dynamoRouter = createDynamoDBRouter({ batchItemFailures: true })

dynamoRouter.route({
  filters: { eventName: 'INSERT', eventSourceArn: ITEM_STREAM_ARN },
  keysSchema: ItemKeysSchema,
  newImageSchema: ItemSchema,
  handler: onItemInserted,
})`},{path:"api-handlers/putItem.ts",code:`import type { ApiRequest } from '@lambda-event-router/apigateway'

import { type Item, type ItemKeys } from '../schemas/item.js'
import { items } from '../services/items.js'

type PathParams = { itemId: string }
type StoredItem = Item & ItemKeys

// query is unknown because the route sets no querySchema
export async function putItem(
  request: ApiRequest<PathParams, unknown, Item>,
): Promise<StoredItem> {
  const { path, body } = request

  const item = { itemId: path.itemId, ...body }
  await items.put(item)

  return item
}`},{path:"db-handlers/onItemInserted.ts",code:`import type { DynamoDBInsertRequest, DynamoDBResponse } from '@lambda-event-router/dynamodb'

import { type Item, type ItemKeys } from '../schemas/item.js'
import { search } from '../services/search.js'

export async function onItemInserted(
  request: DynamoDBInsertRequest<ItemKeys, Item>,
): Promise<DynamoDBResponse> {
  const { keys, newImage } = request

  await search.index(keys.itemId, newImage)
}`},{path:"schemas/item.ts",code:`import { z } from 'zod'

export const ItemSchema = z.object({
  name: z.string(),
  price: z.number().positive(),
})

export const ItemKeysSchema = z.object({ itemId: z.string() })

// Derived from the schemas so the handlers and the validation cannot drift apart
export type Item = z.infer<typeof ItemSchema>
export type ItemKeys = z.infer<typeof ItemKeysSchema>`},{path:"package.json",lang:"json",code:`{
  "name": "items-lambda",
  "type": "module",
  "dependencies": {
    "@lambda-event-router/apigateway": "^1.0.0",
    "@lambda-event-router/dynamodb": "^1.0.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.145",
    "typescript": "^5.9.0"
  }
}`}];return(d,e)=>{const t=i("CodeFileViewer");return n(),r("div",null,[e[0]||(e[0]=s("",22)),h(t,{files:a,id:"multi-router","default-file":"api-handlers/putItem.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),e[1]||(e[1]=s("",4))])}}});export{k as __pageData,c as default};

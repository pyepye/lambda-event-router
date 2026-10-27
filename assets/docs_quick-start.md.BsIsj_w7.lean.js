import{C as i,o as n,c as h,ak as e,E as r}from"./chunks/framework.C2AAou88.js";const c=JSON.parse('{"title":"Quick start","description":"","frontmatter":{},"headers":[],"relativePath":"docs/quick-start.md","filePath":"docs/quick-start.md"}'),l={name:"docs/quick-start.md"},k=Object.assign(l,{setup(p){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { apiMatcher } from './api.js'
import { dynamoMatcher } from './dynamodb.js'

// Two event sources, one entry point
const latcher = new Latcher({ matchers: [apiMatcher, dynamoMatcher] })

export const handler: Handler = latcher.handler()`},{path:"api.ts",code:`import { createAPIGatewayMatcher } from '@latcher/apigateway'

import { putItem } from './api-handlers/putItem.js'
import { ItemSchema } from './schemas/item.js'

export const apiMatcher = createAPIGatewayMatcher()

apiMatcher.route({
  filters: { method: 'PUT', path: '/items/:itemId' },
  bodySchema: ItemSchema,
  handler: putItem,
})`},{path:"dynamodb.ts",code:`import { createDynamoDBMatcher } from '@latcher/dynamodb'

import { onItemInserted } from './db-handlers/onItemInserted.js'
import { ItemKeysSchema, ItemSchema } from './schemas/item.js'

const ITEM_STREAM_ARN = 'arn:aws:dynamodb:eu-west-2:123456789012:table/items/stream/2026-01-01T00:00:00.000'

export const dynamoMatcher = createDynamoDBMatcher({ batchItemFailures: true })

dynamoMatcher.route({
  filters: { eventName: 'INSERT', eventSourceArn: ITEM_STREAM_ARN },
  keysSchema: ItemKeysSchema,
  newImageSchema: ItemSchema,
  handler: onItemInserted,
})`},{path:"api-handlers/putItem.ts",code:`import type { APIGatewayAuth, ApiRequest } from '@latcher/apigateway'

import { type Item, type ItemKeys } from '../schemas/item.js'
import { items } from '../services/items.js'

type PathParams = { itemId: string }
type StoredItem = Item & ItemKeys

// query is unknown because the route sets no querySchema
export async function putItem(
  request: ApiRequest<PathParams, unknown, APIGatewayAuth, Item>,
): Promise<StoredItem> {
  const { path, body } = request

  const item = { itemId: path.itemId, ...body }
  await items.put(item)

  return item
}`},{path:"db-handlers/onItemInserted.ts",code:`import type { DynamoDBInsertRequest, DynamoDBResponse } from '@latcher/dynamodb'

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
    "@latcher/apigateway": "^1.0.0",
    "@latcher/dynamodb": "^1.0.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.145",
    "typescript": "^5.9.0"
  }
}`}];return(d,s)=>{const t=i("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",22)),r(t,{files:a,id:"multi-matcher","default-file":"api-handlers/putItem.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",4))])}}});export{c as __pageData,k as default};

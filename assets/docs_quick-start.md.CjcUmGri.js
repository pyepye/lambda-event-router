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
}`}];return(d,e)=>{const t=i("CodeFileViewer");return n(),r("div",null,[e[0]||(e[0]=s(`<h1 id="quick-start" tabindex="-1">Quick start <a class="header-anchor" href="#quick-start" aria-label="Permalink to &quot;Quick start&quot;">​</a></h1><p>A Lambda handling an SQS queue takes two files. Once that works, adding a second event source to the same Lambda is one more router, which is the part worth being here for.</p><h2 id="install" tabindex="-1">Install <a class="header-anchor" href="#install" aria-label="Permalink to &quot;Install&quot;">​</a></h2><p>One package per event source your Lambda receives. <code>base</code> comes along as a dependency, so there is nothing else to add.</p><div class="language-bash vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> install</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> @lambda-event-router/sqs</span></span></code></pre></div><p>A Lambda sitting behind an HTTP API and a queue takes two:</p><div class="language-bash vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> install</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> @lambda-event-router/apigateway</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> @lambda-event-router/sqs</span></span></code></pre></div><p>If you are not sure which package you need, the <a href="/packages">packages page</a> lists every AWS event source we cover.</p><h2 id="your-first-lambda" tabindex="-1">Your first Lambda <a class="header-anchor" href="#your-first-lambda" aria-label="Permalink to &quot;Your first Lambda&quot;">​</a></h2><h3 id="_1-create-a-router-and-register-a-route" tabindex="-1">1. Create a router and register a route <a class="header-anchor" href="#_1-create-a-router-and-register-a-route" aria-label="Permalink to &quot;1. Create a router and register a route&quot;">​</a></h3><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { createSQSRouter } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;@lambda-event-router/sqs&#39;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { z } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;zod&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { orders } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;../services/orders.js&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> ORDER_QUEUE_ARN</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;arn:aws:sqs:eu-west-2:123456789012:orders&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> OrderSchema</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> z.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">object</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  orderId: z.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">string</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(),</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  quantity: z.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">number</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">().</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">int</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">().</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">positive</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(),</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">export</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> sqsRouter</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> createSQSRouter</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({ batchItemFailures: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> })</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">sqsRouter.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">route</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  filters: {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    eventSourceArn: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">ORDER_QUEUE_ARN</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    messageAttributes: { type: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;OrderPlaced&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  bodySchema: OrderSchema,</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">  handler</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">async</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> ({ </span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">body</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> }) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // body is typed from OrderSchema, with nothing to declare</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> orders.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">save</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({ orderId: body.orderId, quantity: body.quantity })</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span></code></pre></div><p>Breaking that down:</p><ol><li><code>createSQSRouter</code> makes a router for one event source. <code>batchItemFailures: true</code> reports failing records individually so only those get redelivered</li><li><code>filters</code> says which records this route takes, and every key has to match. This one only takes <code>OrderPlaced</code> messages off that queue, so a second route can filter on <code>OrderCancelled</code> and get its own handler. The keys come from the event source, and <a href="/docs/routing#filters">routing</a> lists them</li><li><code>bodySchema</code> parses the message JSON and validates it, then types <code>body</code> from the same schema. See <a href="/docs/routing#schema-validation">schema validation</a> for which libraries work and what a failure does</li><li>SQS hands Lambda a batch of records. The router unpacks it and calls your handler once per record, so ten messages arriving together run it ten times and you write for one message rather than a loop. <a href="/docs/handlers#requests">Handlers</a> covers everything else the request carries</li></ol><h3 id="_2-export-the-lambda-handler" tabindex="-1">2. Export the Lambda handler <a class="header-anchor" href="#_2-export-the-lambda-handler" aria-label="Permalink to &quot;2. Export the Lambda handler&quot;">​</a></h3><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> type</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { Handler } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;aws-lambda&#39;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { LambdaRouter } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;@lambda-event-router/base&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { sqsRouter } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;./routers/sqs.js&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> lambdaRouter</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> new</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> LambdaRouter</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({ routers: [sqsRouter] })</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">export</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> handler</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> Handler</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> lambdaRouter.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">handler</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">()</span></span></code></pre></div><p><code>LambdaRouter</code> is what AWS invokes. It works out which of its <a href="/docs/routers">routers</a> owns each event before any of your filters run, so nothing in your code has to sniff at the event shape.</p><p>Congratulations, that is a working Lambda. Point the queue at it and every message reaches your handler already parsed, validated and typed.</p><h2 id="multiple-event-sources" tabindex="-1">Multiple event sources <a class="header-anchor" href="#multiple-event-sources" aria-label="Permalink to &quot;Multiple event sources&quot;">​</a></h2><p>One <code>LambdaRouter</code> takes as many routers as you need, and each event reaches exactly one of them. Matching happens twice: <code>LambdaRouter</code> picks the router from the shape of the event, then that router picks the route from your filters.</p><ul><li>A <code>PUT /items/:itemId</code> request goes to <code>apiRouter</code>, then to the route filtering on that method and path</li><li>A stream record with <code>eventName: &#39;INSERT&#39;</code> goes to <code>dynamoRouter</code>, then to the route filtering on that event name and stream ARN</li></ul><p>Adding the second router cannot change how the first one&#39;s events are routed, so the API behaves exactly as it did before the stream existed.</p><p>Open a file: <a href="#multi-router:api-handlers/putItem.ts">api-handlers/putItem.ts</a> | <a href="#multi-router:db-handlers/onItemInserted.ts">db-handlers/onItemInserted.ts</a> | <a href="#multi-router:api.ts">api.ts</a> | <a href="#multi-router:dynamodb.ts">dynamodb.ts</a> | <a href="#multi-router:index.ts">index.ts</a></p>`,22)),h(t,{files:a,id:"multi-router","default-file":"api-handlers/putItem.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),e[1]||(e[1]=s('<p>Both handlers above are plain functions with their request types named. Those types can be inferred from the route&#39;s filters and schemas instead when using <code>defineRoute</code>, which puts the route definition in the handler&#39;s file rather than the router&#39;s. See <a href="/docs/handlers#inferred-handlers">handlers</a> for the same two handlers written that way.</p><p><code>ApiRequest</code> takes the path params, then the query params, then the body, and this route sets no <code>querySchema</code> so its query is <code>unknown</code>. Returning the item on its own gives a 200 with the item as the body, and the <a href="/docs/handlers#http-responses">response helpers</a> cover the other status codes.</p><h2 id="where-next" tabindex="-1">Where next <a class="header-anchor" href="#where-next" aria-label="Permalink to &quot;Where next&quot;">​</a></h2><table tabindex="0"><thead><tr><th>Page</th><th>What it covers</th></tr></thead><tbody><tr><td><a href="/docs/routers">Routers</a></td><td>What a router is, and what every one of them has in common</td></tr><tr><td><a href="/docs/routing">Routing</a></td><td>Filter keys, <code>custom</code>, match order and where schemas go</td></tr><tr><td><a href="/docs/handlers">Handlers</a></td><td>What a handler is given and what it may return</td></tr><tr><td><a href="/docs/middleware">Middleware</a></td><td>Running code around your handlers</td></tr><tr><td><a href="/packages">Packages</a></td><td>Every router, with a page each</td></tr></tbody></table>',4))])}}});export{k as __pageData,c as default};

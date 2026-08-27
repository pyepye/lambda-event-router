import{C as i,o as t,c as r,ak as n,E as l}from"./chunks/framework.Ct7YXsF8.js";const k=JSON.parse('{"title":"Quick Start","description":"","frontmatter":{},"headers":[],"relativePath":"docs/quick-start.md","filePath":"docs/quick-start.md"}'),p={name:"docs/quick-start.md"},c=Object.assign(p,{setup(h){const e=[{path:"index.ts",code:`import { LambdaRouter } from '@lambda-event-router/base'
import type { Handler } from 'aws-lambda'

import { apiRouter } from './routers/api.js'
import { sqsRouter } from './routers/sqs.js'

const lambdaRouter = new LambdaRouter({
  routers: [apiRouter, sqsRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"routers/api.ts",code:`import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'
import { createItem } from '../handlers/createItem.js'
import { CreateItemBodySchema, QuerySchema } from '../schemas/item.js'

export const apiRouter = createAPIGatewayRouter()

apiRouter.post({
  path: '/orgs/:orgId/items/:itemId',
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  querySchema: QuerySchema,
})`},{path:"routers/sqs.ts",code:`import { createSQSRouter } from '@lambda-event-router/sqs'
import { processOrder } from '../handlers/processOrder.js'
import { OrderSchema } from '../schemas/order.js'

export const sqsRouter = createSQSRouter()

sqsRouter.route({
  filters: { eventSourceArn: 'arn:aws:sqs:us-east-1:123456789:orders' },
  bodySchema: OrderSchema,
  handler: processOrder,
})`},{path:"handlers/createItem.ts",code:`import type { ApiRequest, ApiResponse } from '@lambda-event-router/apigateway'

type PathParams = { orgId: string; itemId: string }
type QueryParams = { dryRun?: string }
type Body = { name: string; price: number }

interface CreateItemResponse {
  orgId: string
  itemId: string
  name: string
  price: number
}

export async function createItem(
  request: ApiRequest<PathParams, QueryParams, Body>,
): Promise<ApiResponse<CreateItemResponse>> {
  const { orgId, itemId } = request.path
  const { name, price } = request.body

  return {
    statusCode: 201,
    body: { orgId, itemId, name, price },
  }
}`},{path:"handlers/processOrder.ts",code:`import type { SQSHandlerEvent } from '@lambda-event-router/sqs'

interface Order {
  orderId: string
  product: string
  quantity: number
}

export async function processOrder({ body }: SQSHandlerEvent<Order>) {
  console.log(\`Processing order \${body.orderId}: \${body.quantity}x \${body.product}\`)
}`},{path:"schemas/item.ts",code:`import { z } from 'zod'

export const CreateItemBodySchema = z.object({
  name: z.string(),
  price: z.number(),
})

export const QuerySchema = z.object({
  dryRun: z.string().default('false'),
})`},{path:"schemas/order.ts",code:`import { z } from 'zod'

export const OrderSchema = z.object({
  orderId: z.string(),
  product: z.string(),
  quantity: z.number().int().positive(),
})`},{path:"package.json",lang:"json",code:`{
  "name": "my-lambda",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@lambda-event-router/base": "^1.0.0",
    "@lambda-event-router/apigateway": "^1.0.0",
    "@lambda-event-router/sqs": "^1.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "@types/aws-lambda": "^8.10.145"
  }
}`},{path:"api.js",code:`import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'
import { createItem } from '../handlers/createItem.js'
import { CreateItemBodySchema, QuerySchema } from '../schemas/item.js'

export const apiRouter = createAPIGatewayRouter()

apiRouter.post({
  path: '/orgs/:orgId/items/:itemId',
  handler: createItem,
  bodySchema: CreateItemBodySchema,
  querySchema: QuerySchema,
})`},{path:"api.html",code:`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>HTML 5 Boilerplate</title>
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <h1>test</h1>
  </body>
</html>`}];return(o,s)=>{const a=i("CodeFileViewer");return t(),r("div",null,[s[0]||(s[0]=n(`<h1 id="quick-start" tabindex="-1">Quick Start <a class="header-anchor" href="#quick-start" aria-label="Permalink to &quot;Quick Start&quot;">​</a></h1><h2 id="prerequisites" tabindex="-1">Prerequisites <a class="header-anchor" href="#prerequisites" aria-label="Permalink to &quot;Prerequisites&quot;">​</a></h2><ul><li>AWS lambda</li><li>NodeJS</li><li>Blurb around packages and know which AWS services you need</li></ul><h2 id="install" tabindex="-1">Install <a class="header-anchor" href="#install" aria-label="Permalink to &quot;Install&quot;">​</a></h2><ul><li>blurb and link to packages page</li></ul><div class="language-bash vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> install</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> @lambda-event-router/[package]</span></span></code></pre></div><ul><li>When need to support multiple aws services</li></ul><div class="language-bash vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> install</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> @lambda-event-router/apigateway</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> @lambda-event-router/sqs</span></span></code></pre></div><h2 id="your-first-lambda" tabindex="-1">Your first lambda <a class="header-anchor" href="#your-first-lambda" aria-label="Permalink to &quot;Your first lambda&quot;">​</a></h2><ul><li>Break down into steps</li></ul><ol><li>LambdaRouter</li></ol><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { LambdaRouter } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;@lambda-event-router/base&#39;</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { sqsRouter } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;./sqs&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> lambdaRouter</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> new</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> LambdaRouter</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  routers: [sqsRouter]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">export</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> handler</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> lambdaRouter.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">handler</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">()</span></span></code></pre></div><ol start="2"><li>SQS Router</li></ol><div class="language-ts vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">ts</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { createSQSRouter } </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">from</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> &#39;@lambda-event-router/sqs&#39;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> sqsRouter</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> createSQSRouter</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">()</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// Separate handler to define routes and handlers in different places</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">sqsRouter.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">route</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  filters: { eventSourceArn: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;arn:aws:sqs:us-east-1:123456789:my-queue&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  bodySchema: BodySchema,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  handler: processOrder,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// Types do need to be explicitly defined - they can not be inferred by Typescript</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">export</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> async</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> function</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> processOrder</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({ </span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">body</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> }) {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  console.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">log</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">\`Creating item: \${</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">body</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">.</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">name</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">} - $\${</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">body</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">.</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">price</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">}\`</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">)</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><h2 id="multiple-routers" tabindex="-1">Multiple routers <a class="header-anchor" href="#multiple-routers" aria-label="Permalink to &quot;Multiple routers&quot;">​</a></h2><ul><li>Example with file system with APIGateway, DynamoDB and SQS</li></ul><p>Support file linking.</p><p>Open a file: <a href="#multi-router:index.ts">index.ts</a> | <a href="#multi-router:routers/api.ts">API router</a> | <a href="#multi-router:routers/sqs.ts">SQS router</a> | <a href="#multi-router:handlers/createItem.ts">createItem handler</a> | <a href="#multi-router:package.json">package.json</a></p>`,18)),l(a,{files:e,"default-file":"schemas/item.ts",id:"multi-router","line-numbers":"","collapse-toggle":"","fixed-height":""})])}}});export{k as __pageData,c as default};

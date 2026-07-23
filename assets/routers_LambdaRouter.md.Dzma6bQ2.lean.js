import{C as n,o as r,c as o,ak as h,E as d,j as s,a}from"./chunks/framework.Ct7YXsF8.js";const u=JSON.parse('{"title":"LambdaRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/LambdaRouter.md","filePath":"routers/LambdaRouter.md"}'),l={name:"routers/LambdaRouter.md"},g=Object.assign(l,{setup(p){const t=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { apiRouter } from './api.js'
import { eventRouter } from './events.js'
import { withTiming } from './middleware/withTiming.js'
import { sqsRouter } from './sqs.js'

// eventRouter is sorted last whatever order it is written in, so the other two get first refusal
const lambdaRouter = new LambdaRouter({
  routers: [apiRouter, sqsRouter, eventRouter],
  middleware: [withTiming],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"api.ts",code:`import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'

import { getOrder } from './handlers/orders.js'

export const apiRouter = createAPIGatewayRouter()

apiRouter.get({
  filters: { path: '/orders/:orderId' },
  handler: getOrder,
})`},{path:"sqs.ts",code:`import { createSQSRouter } from '@lambda-event-router/sqs'

import { processOrder } from './handlers/orders.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const sqsRouter = createSQSRouter({ batchItemFailures: true })

sqsRouter.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  handler: processOrder,
})`},{path:"events.ts",code:`import { createEventRouter, defineEventRoute, isObject, logger } from '@lambda-event-router/base'
import { z } from 'zod'

export const eventRouter = createEventRouter()

// EventBridge Scheduler sends the payload you configured, so there is no envelope to filter on
const reportRoute = defineEventRoute({
  filters: {
    custom: ({ event }) => isObject(event) && event.command === 'generate-report',
  },
  eventSchema: z.object({
    command: z.literal('generate-report'),
    day: z.iso.date(),
  }),
}).handle(async ({ event }) => {
  logger.info(\`Building the order report for \${event.day}\`)

  return { day: event.day }
})

eventRouter.route(reportRoute)`},{path:"middleware/withTiming.ts",code:`import { logger, type LambdaMiddleware } from '@lambda-event-router/base'

// Global middleware gets the raw event and the Lambda context
export const withTiming: LambdaMiddleware = async (event, context, next) => {
  const startedAt = Date.now()
  logger.appendKeys({ requestId: context.awsRequestId })

  try {
    return await next(event, context)
  } finally {
    logger.info(\`Invocation finished in \${Date.now() - startedAt}ms\`)
  }
}`},{path:"handlers/orders.ts",code:`import type { ApiRequest, HandlerResponse } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'
import type { SQSRequest, SQSResponse } from '@lambda-event-router/sqs'

import { type Order, orders } from '../services/orders.js'

export async function getOrder(
  request: ApiRequest<{ orderId: string }>,
): Promise<HandlerResponse<Order>> {
  return orders.get(request.path.orderId)
}

export async function processOrder(request: SQSRequest<Order>): Promise<SQSResponse> {
  logger.info(\`Processing order \${request.body.orderId} from the queue\`)
  await orders.process(request.body)
}`}];return(k,e)=>{const i=n("CodeFileViewer");return r(),o("div",null,[e[0]||(e[0]=h("",63)),d(i,{files:t,id:"lambda-example","default-file":"index.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),e[1]||(e[1]=s("p",null,[a("Three event sources, one exported handler and one place that knows about all of them. Each router recognises its own events, so nothing in "),s("code",null,"index.ts"),a(" inspects the event and adding a fourth source changes nothing about the first three.")],-1)),e[2]||(e[2]=s("p",null,[s("code",null,"withTiming"),a(" covers all three, because it sits above the router that ends up taking the event. See "),s("a",{href:"/lambda-event-router/docs/middleware"},"middleware"),a(" for the execution order and the three levels it attaches at.")],-1))])}}});export{u as __pageData,g as default};

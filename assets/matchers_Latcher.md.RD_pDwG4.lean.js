import{C as n,o as h,c as r,ak as o,E as l,j as s,a}from"./chunks/framework.C2AAou88.js";const g=JSON.parse('{"title":"Latcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/Latcher.md","filePath":"matchers/Latcher.md"}'),d={name:"matchers/Latcher.md"},y=Object.assign(d,{setup(p){const t=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { apiMatcher } from './api.js'
import { eventMatcher } from './events.js'
import { withTiming } from './middleware/withTiming.js'
import { sqsMatcher } from './sqs.js'

// eventMatcher is sorted last whatever order it is written in, so the other two get first refusal
const latcher = new Latcher({
  matchers: [apiMatcher, sqsMatcher, eventMatcher],
  middleware: [withTiming],
})

export const handler: Handler = latcher.handler()`},{path:"api.ts",code:`import { createAPIGatewayMatcher } from '@latcher/apigateway'

import { getOrder } from './handlers/orders.js'

export const apiMatcher = createAPIGatewayMatcher()

apiMatcher.get({
  filters: { path: '/orders/:orderId' },
  handler: getOrder,
})`},{path:"sqs.ts",code:`import { createSQSMatcher } from '@latcher/sqs'

import { processOrder } from './handlers/orders.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const sqsMatcher = createSQSMatcher({ batchItemFailures: true })

sqsMatcher.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  handler: processOrder,
})`},{path:"events.ts",code:`import { createEventMatcher, defineEventRoute, isObject, logger } from '@latcher/base'
import { z } from 'zod'

export const eventMatcher = createEventMatcher()

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

eventMatcher.route(reportRoute)`},{path:"middleware/withTiming.ts",code:`import { logger, type LambdaMiddleware } from '@latcher/base'

// Global middleware gets the raw event and the Lambda context
export const withTiming: LambdaMiddleware = async (event, context, next) => {
  const startedAt = Date.now()
  logger.appendKeys({ requestId: context.awsRequestId })

  try {
    return await next(event, context)
  } finally {
    logger.info(\`Invocation finished in \${Date.now() - startedAt}ms\`)
  }
}`},{path:"handlers/orders.ts",code:`import type { ApiRequest, HandlerResponse } from '@latcher/apigateway'
import { logger } from '@latcher/base'
import type { SQSRequest, SQSResponse } from '@latcher/sqs'

import { type Order, orders } from '../services/orders.js'

export async function getOrder(
  request: ApiRequest<{ orderId: string }>,
): Promise<HandlerResponse<Order>> {
  return orders.get(request.path.orderId)
}

export async function processOrder(request: SQSRequest<Order>): Promise<SQSResponse> {
  logger.info(\`Processing order \${request.body.orderId} from the queue\`)
  await orders.process(request.body)
}`}];return(c,e)=>{const i=n("CodeFileViewer");return h(),r("div",null,[e[0]||(e[0]=o("",64)),l(i,{files:t,id:"lambda-example","default-file":"index.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),e[1]||(e[1]=s("p",null,[a("Three event sources, one exported handler and one place that knows about all of them. Each matcher recognises its own events, so nothing in "),s("code",null,"index.ts"),a(" inspects the event and adding a fourth source changes nothing about the first three.")],-1)),e[2]||(e[2]=s("p",null,[s("code",null,"withTiming"),a(" covers all three, because it sits above the matcher that ends up taking the event. See "),s("a",{href:"/latcher/docs/middleware"},"middleware"),a(" for the execution order and the three levels it attaches at.")],-1))])}}});export{g as __pageData,y as default};

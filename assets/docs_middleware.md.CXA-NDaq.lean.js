import{C as n,o as h,c as l,ak as r,E as p,j as i,a}from"./chunks/framework.DiNuf6zK.js";const E=JSON.parse('{"title":"Middleware","description":"","frontmatter":{},"headers":[],"relativePath":"docs/middleware.md","filePath":"docs/middleware.md"}'),d={name:"docs/middleware.md"},c=Object.assign(d,{setup(k){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { withTiming } from './middleware/withTiming.js'
import { apiRouter } from './routers/api.js'
import { sqsRouter } from './routers/sqs.js'

// One place to cover every event this Lambda receives
const lambdaRouter = new LambdaRouter({
  routers: [apiRouter, sqsRouter],
  middleware: [withTiming],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"middleware/withTiming.ts",code:`import { logger, type LambdaMiddleware } from '@lambda-event-router/base'

// Global middleware gets the raw event and the Lambda context
export const withTiming: LambdaMiddleware = async (event, context, next) => {
  const startedAt = Date.now()
  logger.appendKeys({ requestId: context.awsRequestId })

  try {
    return await next(event, context)
  } finally {
    logger.info('Invocation finished', { durationMs: Date.now() - startedAt })
  }
}`},{path:"middleware/withRequestLog.ts",code:`import type { HTTPMiddleware } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'

// Logs on the way out, so the status code and duration are known
export const withRequestLog: HTTPMiddleware = async (request, next) => {
  const response = await next(request)
  logger.info('Request handled', { method: request.method, path: request.path })

  return response
}`},{path:"middleware/withApiKey.ts",code:`import type { HTTPMiddleware } from '@lambda-event-router/apigateway'
import { Unauthorised } from '@lambda-event-router/apigateway'

import { apiKeys } from '../services/apiKeys.js'

// Returning without calling next() means the handler never runs
export const withApiKey: HTTPMiddleware = async (request, next) => {
  const key = request.headers['x-api-key']
  if (!key || !(await apiKeys.isValid(key))) {
    return Unauthorised({ error: 'Provide a valid x-api-key header' })
  }

  return next(request)
}`},{path:"middleware/withRecordTiming.ts",code:`import { logger } from '@lambda-event-router/base'
import type { SQSMiddleware } from '@lambda-event-router/sqs'

// Runs once per record, and records in a batch run in parallel, so the ids go on the log call
export const withRecordTiming: SQSMiddleware = async (request, next) => {
  const startedAt = Date.now()

  try {
    return await next(request)
  } finally {
    logger.info('Record handled', {
      messageId: request.record.messageId,
      durationMs: Date.now() - startedAt,
    })
  }
}`},{path:"middleware/withQuarantine.ts",code:`import { logger } from '@lambda-event-router/base'
import type { SQSMiddleware } from '@lambda-event-router/sqs'

import { quarantine } from '../services/quarantine.js'

// Rethrowing leaves redelivery alone, swallowing marks the record as handled
export const withQuarantine: SQSMiddleware = async (request, next) => {
  try {
    return await next(request)
  } catch (error) {
    if (Number(request.record.attributes.ApproximateReceiveCount) < 3) throw error

    logger.warn('Quarantining message after three attempts', { error })
    await quarantine.send(request.body)
  }
}`},{path:"routers/api.ts",code:`import { createAPIGatewayRouter } from '@lambda-event-router/apigateway'

import { createOrder } from '../handlers/createOrder.js'
import { getOrder } from '../handlers/getOrder.js'
import { withApiKey } from '../middleware/withApiKey.js'
import { withRequestLog } from '../middleware/withRequestLog.js'

// Router middleware covers both routes below
export const apiRouter = createAPIGatewayRouter({ middleware: [withRequestLog] })

apiRouter.get({
  filters: { path: '/orders/:orderId' },
  handler: getOrder,
})

// Route middleware wraps this one only, so the read above stays open
apiRouter.post({
  filters: { path: '/orders' },
  middleware: [withApiKey],
  handler: createOrder,
})`},{path:"routers/sqs.ts",code:`import { createSQSRouter } from '@lambda-event-router/sqs'

import { processOrder } from '../handlers/processOrder.js'
import { withQuarantine } from '../middleware/withQuarantine.js'
import { withRecordTiming } from '../middleware/withRecordTiming.js'

const ORDER_QUEUE_ARN = 'arn:aws:sqs:eu-west-2:123456789012:orders'

export const sqsRouter = createSQSRouter({
  batchItemFailures: true,
  middleware: [withRecordTiming],
})

// withQuarantine only rethrows for the first two attempts, so redelivery still works
sqsRouter.route({
  filters: { eventSourceArn: ORDER_QUEUE_ARN },
  middleware: [withQuarantine],
  handler: processOrder,
})`}];return(o,s)=>{const t=n("CodeFileViewer");return h(),l("div",null,[s[0]||(s[0]=r("",56)),p(t,{files:e,id:"middleware-example","default-file":"routers/api.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("p",null,[a("Each "),i("a",{href:"/packages"},"router page"),a(" lists its own middleware type alongside the options it accepts.")],-1))])}}});export{E as __pageData,c as default};

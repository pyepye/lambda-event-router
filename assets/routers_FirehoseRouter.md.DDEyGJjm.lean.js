import{C as t,o as n,c as h,ak as e,E as r}from"./chunks/framework.Ct7YXsF8.js";const k=JSON.parse('{"title":"FirehoseRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/FirehoseRouter.md","filePath":"routers/FirehoseRouter.md"}'),l={name:"routers/FirehoseRouter.md"},c=Object.assign(l,{setup(d){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { firehoseRouter } from './firehose.js'

const lambdaRouter = new LambdaRouter({
  routers: [firehoseRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"firehose.ts",code:`import { createFirehoseRouter } from '@lambda-event-router/firehose'

import { enrichAppEvent, normaliseLogLine } from './handlers/logs.js'
import { AppEventSchema, LogLineSchema } from './schemas/log.js'

const WEB_LOG_STREAM_ARN = 'arn:aws:firehose:eu-west-2:123456789012:deliverystream/web-logs'
const APP_EVENT_STREAM_ARN = 'arn:aws:firehose:eu-west-2:123456789012:deliverystream/app-events'

export const firehoseRouter = createFirehoseRouter()

firehoseRouter
  .route({
    filters: { deliveryStreamArn: WEB_LOG_STREAM_ARN },
    dataSchema: LogLineSchema,
    handler: normaliseLogLine,
  })
  .route({
    filters: { deliveryStreamArn: APP_EVENT_STREAM_ARN },
    dataSchema: AppEventSchema,
    handler: enrichAppEvent,
  })`},{path:"handlers/logs.ts",code:`import type { FirehoseRequest, FirehoseResponse } from '@lambda-event-router/firehose'
import { Dropped, Ok } from '@lambda-event-router/firehose'

import type { AppEvent, LogLine } from '../schemas/log.js'

export async function normaliseLogLine(request: FirehoseRequest<LogLine>): Promise<FirehoseResponse> {
  const { path, status, durationMs, receivedAt } = request.data
  if (path.startsWith('/health')) return Dropped()

  const day = receivedAt.toISOString().slice(0, 10)

  return Ok({ path, status, durationMs, day }, { partitionKeys: { day } })
}

export async function enrichAppEvent(request: FirehoseRequest<AppEvent>): Promise<FirehoseResponse> {
  const { name, userId } = request.data

  return Ok({ name, userId, recordId: request.recordId })
}`},{path:"schemas/log.ts",code:`import { z } from 'zod'

export const LogLineSchema = z.object({
  path: z.string(),
  status: z.coerce.number(),
  durationMs: z.coerce.number(),
  receivedAt: z.coerce.date(),
})

export const AppEventSchema = z.object({
  name: z.string(),
  userId: z.string(),
})

export type LogLine = z.infer<typeof LogLineSchema>
export type AppEvent = z.infer<typeof AppEventSchema>`}];return(o,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",84)),r(a,{files:i,id:"firehose-example","default-file":"firehose.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",3))])}}});export{k as __pageData,c as default};

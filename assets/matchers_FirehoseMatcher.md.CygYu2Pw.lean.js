import{C as t,o as n,c as h,ak as e,E as r}from"./chunks/framework.C2AAou88.js";const k=JSON.parse('{"title":"FirehoseMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/FirehoseMatcher.md","filePath":"matchers/FirehoseMatcher.md"}'),l={name:"matchers/FirehoseMatcher.md"},c=Object.assign(l,{setup(d){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { firehoseMatcher } from './firehose.js'

const latcher = new Latcher({
  matchers: [firehoseMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"firehose.ts",code:`import { createFirehoseMatcher } from '@latcher/firehose'

import { enrichAppEvent, normaliseLogLine } from './handlers/logs.js'
import { AppEventSchema, LogLineSchema } from './schemas/log.js'

const WEB_LOG_STREAM_ARN = 'arn:aws:firehose:eu-west-2:123456789012:deliverystream/web-logs'
const APP_EVENT_STREAM_ARN = 'arn:aws:firehose:eu-west-2:123456789012:deliverystream/app-events'

export const firehoseMatcher = createFirehoseMatcher()

firehoseMatcher
  .route({
    filters: { deliveryStreamArn: WEB_LOG_STREAM_ARN },
    dataSchema: LogLineSchema,
    handler: normaliseLogLine,
  })
  .route({
    filters: { deliveryStreamArn: APP_EVENT_STREAM_ARN },
    dataSchema: AppEventSchema,
    handler: enrichAppEvent,
  })`},{path:"handlers/logs.ts",code:`import type { FirehoseRequest, FirehoseResponse } from '@latcher/firehose'
import { Dropped, Ok } from '@latcher/firehose'

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
export type AppEvent = z.infer<typeof AppEventSchema>`}];return(p,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",85)),r(a,{files:i,id:"firehose-example","default-file":"firehose.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",3))])}}});export{k as __pageData,c as default};

import{C as t,o as n,c as h,ak as i,E as r}from"./chunks/framework.DiNuf6zK.js";const o=JSON.parse('{"title":"KinesisRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/KinesisRouter.md","filePath":"routers/KinesisRouter.md"}'),l={name:"routers/KinesisRouter.md"},c=Object.assign(l,{setup(d){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { kinesisRouter } from './kinesis.js'

const lambdaRouter = new LambdaRouter({
  routers: [kinesisRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"kinesis.ts",code:`import { createKinesisRouter } from '@lambda-event-router/kinesis'

import { onReading, onStatusChange } from './handlers/devices.js'
import { ReadingSchema, StatusSchema } from './schemas/device.js'

const TELEMETRY_STREAM_ARN = 'arn:aws:kinesis:eu-west-2:123456789012:stream/device-telemetry'
const STATUS_STREAM_ARN = 'arn:aws:kinesis:eu-west-2:123456789012:stream/device-status'

export const kinesisRouter = createKinesisRouter({ batchItemFailures: true })

kinesisRouter
  .route({
    filters: { eventSourceArn: TELEMETRY_STREAM_ARN },
    dataSchema: ReadingSchema,
    handler: onReading,
  })
  .route({
    filters: { eventSourceArn: STATUS_STREAM_ARN },
    dataSchema: StatusSchema,
    handler: onStatusChange,
  })`},{path:"handlers/devices.ts",code:`import { logger } from '@lambda-event-router/base'
import type { KinesisRequest, KinesisResponse } from '@lambda-event-router/kinesis'

import type { Reading, Status } from '../schemas/device.js'

const ALERT_THRESHOLD_C = 80

export async function onReading(request: KinesisRequest<Reading>): Promise<KinesisResponse> {
  const { deviceId, celsius } = request.data
  if (celsius < ALERT_THRESHOLD_C) return

  logger.info(\`Device \${deviceId} is running hot at \${celsius}C\`)
}

export async function onStatusChange(request: KinesisRequest<Status>): Promise<KinesisResponse> {
  const { deviceId, status } = request.data
  logger.info(\`Device \${deviceId} went \${status} at sequence \${request.sequenceNumber}\`)
}`},{path:"schemas/device.ts",code:`import { z } from 'zod'

export const ReadingSchema = z.object({
  deviceId: z.string(),
  celsius: z.coerce.number(),
  recordedAt: z.coerce.date(),
})

export const StatusSchema = z.object({
  deviceId: z.string(),
  status: z.enum(['online', 'offline', 'degraded']),
})

export type Reading = z.infer<typeof ReadingSchema>
export type Status = z.infer<typeof StatusSchema>`}];return(p,s)=>{const e=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=i("",73)),r(e,{files:a,id:"kinesis-example","default-file":"kinesis.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("",3))])}}});export{o as __pageData,c as default};

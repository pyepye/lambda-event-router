import{C as t,o as n,c as h,ak as i,E as r}from"./chunks/framework.C2AAou88.js";const o=JSON.parse('{"title":"KinesisMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/KinesisMatcher.md","filePath":"matchers/KinesisMatcher.md"}'),l={name:"matchers/KinesisMatcher.md"},c=Object.assign(l,{setup(d){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { kinesisMatcher } from './kinesis.js'

const latcher = new Latcher({
  matchers: [kinesisMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"kinesis.ts",code:`import { createKinesisMatcher } from '@latcher/kinesis'

import { onReading, onStatusChange } from './handlers/devices.js'
import { ReadingSchema, StatusSchema } from './schemas/device.js'

const TELEMETRY_STREAM_ARN = 'arn:aws:kinesis:eu-west-2:123456789012:stream/device-telemetry'
const STATUS_STREAM_ARN = 'arn:aws:kinesis:eu-west-2:123456789012:stream/device-status'

export const kinesisMatcher = createKinesisMatcher({ batchItemFailures: true })

kinesisMatcher
  .route({
    filters: { eventSourceArn: TELEMETRY_STREAM_ARN },
    dataSchema: ReadingSchema,
    handler: onReading,
  })
  .route({
    filters: { eventSourceArn: STATUS_STREAM_ARN },
    dataSchema: StatusSchema,
    handler: onStatusChange,
  })`},{path:"handlers/devices.ts",code:`import { logger } from '@latcher/base'
import type { KinesisRequest, KinesisResponse } from '@latcher/kinesis'

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
export type Status = z.infer<typeof StatusSchema>`}];return(p,s)=>{const e=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=i("",81)),r(e,{files:a,id:"kinesis-example","default-file":"kinesis.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("",3))])}}});export{o as __pageData,c as default};

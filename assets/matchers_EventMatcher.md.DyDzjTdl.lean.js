import{C as t,o as n,c as h,ak as e,E as l}from"./chunks/framework.C2AAou88.js";const o=JSON.parse('{"title":"EventMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/EventMatcher.md","filePath":"matchers/EventMatcher.md"}'),r={name:"matchers/EventMatcher.md"},c=Object.assign(r,{setup(p){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { eventMatcher } from './events.js'

const latcher = new Latcher({
  matchers: [eventMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"events.ts",code:`import { createEventMatcher, isObject } from '@latcher/base'

import { generateReport, purgeCache, reindex } from './handlers/operations.js'
import { PurgeSchema, ReindexSchema, ReportSchema } from './schemas/operations.js'

export const eventMatcher = createEventMatcher()

// Each route tests a different command, so no event matches two and the order does not matter
eventMatcher
  .route({
    filters: { custom: ({ event }) => isObject(event) && event.command === 'generate-report' },
    eventSchema: ReportSchema,
    handler: generateReport,
  })
  .route({
    filters: { custom: ({ event }) => isObject(event) && event.command === 'reindex' },
    eventSchema: ReindexSchema,
    handler: reindex,
  })
  .route({
    filters: { custom: ({ event }) => isObject(event) && event.command === 'purge-cache' },
    eventSchema: PurgeSchema,
    handler: purgeCache,
  })`},{path:"handlers/operations.ts",code:`import { logger } from '@latcher/base'
import type { EventRequest } from '@latcher/base'

import type { Purge, Reindex, Report } from '../schemas/operations.js'

export async function generateReport(request: EventRequest<Report>): Promise<unknown> {
  const { reportId, day } = request.event
  logger.info(\`Building report \${reportId} for \${day}\`)

  return { reportId, status: 'built' }
}

export async function reindex(request: EventRequest<Reindex>): Promise<unknown> {
  const { collection, batchSize } = request.event
  logger.info(\`Reindexing \${collection} in batches of \${batchSize}\`)

  return { collection, status: 'reindexed' }
}

export async function purgeCache(request: EventRequest<Purge>): Promise<unknown> {
  logger.info(\`Purging the cache for \${request.event.tenantId}\`)

  return { tenantId: request.event.tenantId, status: 'purged' }
}`},{path:"schemas/operations.ts",code:`import { z } from 'zod'

// The literal narrows the type the handler sees. The custom reads the raw event instead
export const ReportSchema = z.object({
  command: z.literal('generate-report'),
  reportId: z.string(),
  day: z.iso.date(),
})

export const ReindexSchema = z.object({
  command: z.literal('reindex'),
  collection: z.string(),
  batchSize: z.coerce.number().default(500),
})

export const PurgeSchema = z.object({
  command: z.literal('purge-cache'),
  tenantId: z.string(),
})

export type Report = z.infer<typeof ReportSchema>
export type Reindex = z.infer<typeof ReindexSchema>
export type Purge = z.infer<typeof PurgeSchema>`}];return(d,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",82)),l(a,{files:i,id:"event-example","default-file":"events.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",3))])}}});export{o as __pageData,c as default};

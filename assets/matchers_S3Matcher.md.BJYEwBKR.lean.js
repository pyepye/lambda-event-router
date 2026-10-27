import{C as a,o as n,c as d,ak as t,E as h}from"./chunks/framework.C2AAou88.js";const p=JSON.parse('{"title":"S3Matcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/S3Matcher.md","filePath":"matchers/S3Matcher.md"}'),o={name:"matchers/S3Matcher.md"},k=Object.assign(o,{setup(r){const s=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { s3BatchMatcher } from './s3Batch.js'
import { s3Matcher } from './s3.js'

const latcher = new Latcher({
  matchers: [s3Matcher, s3BatchMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"s3.ts",code:`import { createS3Matcher } from '@latcher/s3'

import { onUploadRemoved, processImage, processReport } from './handlers/uploads.js'

const UPLOADS_BUCKET = 'acme-uploads'

export const s3Matcher = createS3Matcher()

s3Matcher
  .objectCreatedPut({
    filters: { bucket: UPLOADS_BUCKET, key: 'reports/*.csv' },
    handler: processReport,
  })
  .objectCreatedPut({
    filters: { bucket: UPLOADS_BUCKET, key: ['images/*.jpg', 'images/*.png'] },
    handler: processImage,
  })
  .objectRemoved({
    filters: { bucket: UPLOADS_BUCKET },
    handler: onUploadRemoved,
  })`},{path:"s3Batch.ts",code:`import { createS3BatchMatcher } from '@latcher/s3'

import { reprocessReport } from './handlers/reprocess.js'

export const s3BatchMatcher = createS3BatchMatcher().route({
  handler: reprocessReport,
})`},{path:"handlers/uploads.ts",code:`import { logger } from '@latcher/base'
import type { S3ObjectCreatedRequest, S3ObjectRemovedRequest } from '@latcher/s3'

export async function processReport(request: S3ObjectCreatedRequest): Promise<void> {
  const { key, objectSize } = request
  logger.info(\`Parsing report \${key}, \${objectSize} bytes\`)
}

export async function processImage(request: S3ObjectCreatedRequest): Promise<void> {
  const { key, eTag } = request
  logger.info(\`Generating thumbnails for \${key}, eTag \${eTag}\`)
}

export async function onUploadRemoved(request: S3ObjectRemovedRequest): Promise<void> {
  logger.info(\`Deleting anything derived from \${request.key}\`)
}`},{path:"handlers/reprocess.ts",code:`import { logger } from '@latcher/base'
import type { S3BatchRequest, S3BatchResponse } from '@latcher/s3'
import { PermanentFailure, Succeeded } from '@latcher/s3'

export async function reprocessReport(request: S3BatchRequest): Promise<S3BatchResponse> {
  const { bucket, key } = request

  if (!key.endsWith('.csv')) {
    return PermanentFailure(\`\${key} is not a report\`)
  }

  logger.info(\`Reprocessing \${key} from \${bucket}\`)
  return Succeeded(\`Reprocessed \${key}\`)
}`}];return(l,e)=>{const i=a("CodeFileViewer");return n(),d("div",null,[e[0]||(e[0]=t("",90)),h(i,{files:s,id:"s3-example","default-file":"s3.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),e[1]||(e[1]=t("",4))])}}});export{p as __pageData,k as default};

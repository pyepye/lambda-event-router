import{C as a,o as n,c as d,ak as s,E as h}from"./chunks/framework.Ct7YXsF8.js";const k=JSON.parse('{"title":"S3Router","description":"","frontmatter":{},"headers":[],"relativePath":"routers/S3Router.md","filePath":"routers/S3Router.md"}'),o={name:"routers/S3Router.md"},c=Object.assign(o,{setup(r){const t=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { s3Router } from './s3.js'

const lambdaRouter = new LambdaRouter({
  routers: [s3Router],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"s3.ts",code:`import { createS3Router } from '@lambda-event-router/s3'

import { onUploadRemoved, processImage, processReport } from './handlers/uploads.js'
import { reprocessReport } from './handlers/reprocess.js'

const UPLOADS_BUCKET = 'acme-uploads'

export const s3Router = createS3Router()

s3Router
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
  })
  .batchOperation({
    handler: reprocessReport,
  })`},{path:"handlers/uploads.ts",code:`import { logger } from '@lambda-event-router/base'
import type { S3ObjectCreatedRequest, S3ObjectRemovedRequest } from '@lambda-event-router/s3'

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
}`},{path:"handlers/reprocess.ts",code:`import { logger } from '@lambda-event-router/base'
import type { S3BatchRequest, S3BatchResponse } from '@lambda-event-router/s3'
import { PermanentFailure, Succeeded } from '@lambda-event-router/s3'

export async function reprocessReport(request: S3BatchRequest): Promise<S3BatchResponse> {
  const { bucket, key } = request

  if (!key.endsWith('.csv')) {
    return PermanentFailure(\`\${key} is not a report\`)
  }

  logger.info(\`Reprocessing \${key} from \${bucket}\`)
  return Succeeded(\`Reprocessed \${key}\`)
}`}];return(l,e)=>{const i=a("CodeFileViewer");return n(),d("div",null,[e[0]||(e[0]=s("",102)),h(i,{files:t,id:"s3-example","default-file":"s3.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),e[1]||(e[1]=s("",4))])}}});export{k as __pageData,c as default};

import{C as t,o as n,c as h,ak as e,E as l}from"./chunks/framework.DiNuf6zK.js";const k=JSON.parse('{"title":"CodePipelineRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/CodePipelineRouter.md","filePath":"routers/CodePipelineRouter.md"}'),r={name:"routers/CodePipelineRouter.md"},c=Object.assign(r,{setup(o){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { codePipelineRouter } from './codepipeline.js'

const lambdaRouter = new LambdaRouter({
  routers: [codePipelineRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"codepipeline.ts",code:`import { createCodePipelineRouter } from '@lambda-event-router/codepipeline'

import { resumeMigration, runDeploy, startMigration } from './handlers/actions.js'
import { DeployParametersSchema } from './schemas/deploy.js'

export const codePipelineRouter = createCodePipelineRouter()

codePipelineRouter
  .continuation({
    filters: { functionName: 'migrate' },
    handler: resumeMigration,
  })
  .route({
    filters: { functionName: 'migrate', hasContinuationToken: false },
    handler: startMigration,
  })
  .route({
    filters: { functionName: 'deploy' },
    userParametersSchema: DeployParametersSchema,
    handler: runDeploy,
  })`},{path:"handlers/actions.ts",code:`import { logger } from '@lambda-event-router/base'
import type { CodePipelineRequest, CodePipelineResponse } from '@lambda-event-router/codepipeline'

import type { DeployParameters } from '../schemas/deploy.js'

export async function runDeploy(
  request: CodePipelineRequest<DeployParameters>,
): Promise<CodePipelineResponse> {
  const { environment, region } = request.userParameters
  logger.info(\`Deploying job \${request.jobId} to \${environment} in \${region}\`)
  return { outputVariables: { deployedRegion: region } }
}

export async function startMigration(request: CodePipelineRequest): Promise<CodePipelineResponse> {
  logger.info(\`Starting migration job \${request.jobId}\`)
  return { continuationToken: '1' }
}

export async function resumeMigration(request: CodePipelineRequest): Promise<CodePipelineResponse> {
  const step = Number(request.continuationToken)
  logger.info(\`Resuming migration job \${request.jobId} at step \${step}\`)
  if (step < 3) return { continuationToken: String(step + 1) }
}`},{path:"schemas/deploy.ts",code:`import { z } from 'zod'

export const DeployParametersSchema = z.object({
  environment: z.enum(['staging', 'production']),
  region: z.string(),
})

export type DeployParameters = z.infer<typeof DeployParametersSchema>`}];return(p,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",75)),l(a,{files:i,id:"codepipeline-example","default-file":"codepipeline.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",2))])}}});export{k as __pageData,c as default};

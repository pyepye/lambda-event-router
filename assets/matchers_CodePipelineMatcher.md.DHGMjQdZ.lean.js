import{C as t,o as n,c as h,ak as e,E as l}from"./chunks/framework.C2AAou88.js";const k=JSON.parse('{"title":"CodePipelineMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/CodePipelineMatcher.md","filePath":"matchers/CodePipelineMatcher.md"}'),r={name:"matchers/CodePipelineMatcher.md"},c=Object.assign(r,{setup(p){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { codePipelineMatcher } from './codepipeline.js'

const latcher = new Latcher({
  matchers: [codePipelineMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"codepipeline.ts",code:`import { createCodePipelineMatcher } from '@latcher/codepipeline'

import { resumeMigration, runDeploy, startMigration } from './handlers/actions.js'
import { DeployParametersSchema } from './schemas/deploy.js'

export const codePipelineMatcher = createCodePipelineMatcher()

codePipelineMatcher
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
  })`},{path:"handlers/actions.ts",code:`import { logger } from '@latcher/base'
import type { CodePipelineRequest, CodePipelineResponse } from '@latcher/codepipeline'

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

export type DeployParameters = z.infer<typeof DeployParametersSchema>`}];return(o,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",75)),l(a,{files:i,id:"codepipeline-example","default-file":"codepipeline.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",2))])}}});export{k as __pageData,c as default};

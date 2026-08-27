import{C as a,o as n,c as h,ak as s,E as r}from"./chunks/framework.DiNuf6zK.js";const k=JSON.parse('{"title":"CodeCommitRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/CodeCommitRouter.md","filePath":"routers/CodeCommitRouter.md"}'),o={name:"routers/CodeCommitRouter.md"},c=Object.assign(o,{setup(d){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { codeCommitRouter } from './codecommit.js'

const lambdaRouter = new LambdaRouter({
  routers: [codeCommitRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"codecommit.ts",code:`import { createCodeCommitRouter } from '@lambda-event-router/codecommit'

import { onAnyChange, onBranchDeleted, onMainPush, onReleasePush } from './handlers/repository.js'

const CHECKOUT_REPO_ARN = 'arn:aws:codecommit:eu-west-2:123456789012:checkout-service'

export const codeCommitRouter = createCodeCommitRouter()

codeCommitRouter
  .push({
    filters: { eventSourceArn: CHECKOUT_REPO_ARN, branch: 'main' },
    handler: onMainPush,
  })
  .push({
    filters: { eventSourceArn: CHECKOUT_REPO_ARN, branch: 'release/*' },
    handler: onReleasePush,
  })
  .branchDeleted({
    filters: { eventSourceArn: CHECKOUT_REPO_ARN },
    handler: onBranchDeleted,
  })
  .route({
    filters: { eventSourceArn: CHECKOUT_REPO_ARN },
    handler: onAnyChange,
  })`},{path:"handlers/repository.ts",code:`import { logger } from '@lambda-event-router/base'
import type { CodeCommitRequest, CodeCommitResponse } from '@lambda-event-router/codecommit'

export async function onMainPush(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  for (const reference of request.references) {
    logger.info(\`Deploying \${reference.commit} from \${reference.ref}\`)
  }
}

export async function onReleasePush(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  for (const reference of request.references) {
    logger.info(\`Release branch \${reference.ref} moved to \${reference.commit}\`)
  }
}

export async function onBranchDeleted(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  const branches = request.references.map((reference) => reference.ref).join(', ')

  logger.info(\`\${request.userIdentityARN} deleted \${branches}\`)
}

export async function onAnyChange(request: CodeCommitRequest): Promise<CodeCommitResponse> {
  const { references, userIdentityARN, eventTriggerName } = request

  logger.info(\`\${eventTriggerName}: \${references.length} refs moved by \${userIdentityARN}\`)
}`}];return(l,e)=>{const t=a("CodeFileViewer");return n(),h("div",null,[e[0]||(e[0]=s("",75)),r(t,{files:i,id:"codecommit-example","default-file":"codecommit.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),e[1]||(e[1]=s("",4))])}}});export{k as __pageData,c as default};

import{C as a,o as n,c as h,ak as s,E as r}from"./chunks/framework.C2AAou88.js";const c=JSON.parse('{"title":"CodeCommitMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/CodeCommitMatcher.md","filePath":"matchers/CodeCommitMatcher.md"}'),o={name:"matchers/CodeCommitMatcher.md"},k=Object.assign(o,{setup(d){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { codeCommitMatcher } from './codecommit.js'

const latcher = new Latcher({
  matchers: [codeCommitMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"codecommit.ts",code:`import { createCodeCommitMatcher } from '@latcher/codecommit'

import { onAnyChange, onBranchDeleted, onMainPush, onReleasePush } from './handlers/repository.js'

const CHECKOUT_REPO_ARN = 'arn:aws:codecommit:eu-west-2:123456789012:checkout-service'

export const codeCommitMatcher = createCodeCommitMatcher()

codeCommitMatcher
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
  })`},{path:"handlers/repository.ts",code:`import { logger } from '@latcher/base'
import type { CodeCommitRequest, CodeCommitResponse } from '@latcher/codecommit'

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
}`}];return(l,e)=>{const t=a("CodeFileViewer");return n(),h("div",null,[e[0]||(e[0]=s("",75)),r(t,{files:i,id:"codecommit-example","default-file":"codecommit.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),e[1]||(e[1]=s("",4))])}}});export{c as __pageData,k as default};

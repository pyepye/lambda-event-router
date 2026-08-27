import{C as t,o as n,c as h,ak as i,E as r}from"./chunks/framework.DiNuf6zK.js";const k=JSON.parse('{"title":"SESRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/SESRouter.md","filePath":"routers/SESRouter.md"}'),l={name:"routers/SESRouter.md"},c=Object.assign(l,{setup(d){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { sesRouter } from './ses.js'

const lambdaRouter = new LambdaRouter({
  routers: [sesRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"ses.ts",code:`import { createSESRouter } from '@lambda-event-router/ses'

import { onBounce, onSupportEmail, onSuspectEmail } from './handlers/email.js'

export const sesRouter = createSESRouter()

sesRouter
  .route({
    filters: {
      recipient: 'support@example.com',
      spamVerdict: 'PASS',
      virusVerdict: 'PASS',
    },
    handler: onSupportEmail,
  })
  .route({
    filters: {
      recipient: 'bounces@example.com',
      spamVerdict: 'PASS',
      virusVerdict: 'PASS',
    },
    handler: onBounce,
  })
  .route({
    filters: {},
    handler: onSuspectEmail,
  })`},{path:"handlers/email.ts",code:`import { logger } from '@lambda-event-router/base'
import type { SESRequest, SESResponse } from '@lambda-event-router/ses'

export async function onSupportEmail(request: SESRequest): Promise<SESResponse> {
  const { source, subject, mail } = request

  logger.info(\`Support email from \${source} (\${subject ?? 'no subject'}), body at \${mail.messageId}\`)
}

export async function onBounce(request: SESRequest): Promise<SESResponse> {
  logger.info(\`Bounce from \${request.source} about \${request.subject ?? 'no subject'}\`)
}

export async function onSuspectEmail(request: SESRequest): Promise<SESResponse> {
  const { spamVerdict, virusVerdict } = request.receipt

  logger.info(\`Holding \${request.source}: spam \${spamVerdict.status}, virus \${virusVerdict.status}\`)

  return 'STOP_RULE_SET'
}`}];return(p,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=i("",72)),r(a,{files:e,id:"ses-example","default-file":"ses.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("",4))])}}});export{k as __pageData,c as default};

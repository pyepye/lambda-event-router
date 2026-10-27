import{C as t,o as n,c as h,ak as i,E as l}from"./chunks/framework.C2AAou88.js";const k=JSON.parse('{"title":"SESMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/SESMatcher.md","filePath":"matchers/SESMatcher.md"}'),r={name:"matchers/SESMatcher.md"},c=Object.assign(r,{setup(d){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { sesMatcher } from './ses.js'

const latcher = new Latcher({
  matchers: [sesMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"ses.ts",code:`import { createSESMatcher } from '@latcher/ses'

import { onBounce, onSupportEmail, onSuspectEmail } from './handlers/email.js'

export const sesMatcher = createSESMatcher()

sesMatcher
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
  })`},{path:"handlers/email.ts",code:`import { logger } from '@latcher/base'
import type { SESRequest, SESResponse } from '@latcher/ses'

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
}`}];return(p,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=i("",72)),l(a,{files:e,id:"ses-example","default-file":"ses.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("",4))])}}});export{k as __pageData,c as default};

import{C as n,o as h,c as l,ak as r,E as d,j as i,a}from"./chunks/framework.DiNuf6zK.js";const E=JSON.parse('{"title":"ConfigScheduledRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/ConfigScheduledRouter.md","filePath":"routers/ConfigScheduledRouter.md"}'),p={name:"routers/ConfigScheduledRouter.md"},g=Object.assign(p,{setup(k){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { scheduledRouter } from './scheduled.js'

const lambdaRouter = new LambdaRouter({
  routers: [scheduledRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"scheduled.ts",code:`import { ConfigServiceClient, PutEvaluationsCommand } from '@aws-sdk/client-config-service'
import { logger } from '@lambda-event-router/base'
import { createConfigScheduledRouter, defineConfigScheduledRoute } from '@lambda-event-router/config'

import { tagAuditParamsSchema } from './schemas/rules.js'

const config = new ConfigServiceClient({})

export const scheduledRouter = createConfigScheduledRouter()

scheduledRouter
  .route(
    defineConfigScheduledRoute({
      filters: { configRuleName: 'periodic-tag-audit' },
      ruleParametersSchema: tagAuditParamsSchema,
    }).handle(async ({ accountId, ruleParameters, resultToken }) => {
      const requiredTags = JSON.parse(ruleParameters.requiredTags) as string[]
      logger.info(\`Auditing tags \${requiredTags.join(', ')} in account \${accountId}\`)
      await report(accountId, true, resultToken)
    }),
  )
  .route(
    defineConfigScheduledRoute({
      filters: {
        configRuleName: 'cross-account-access-check',
        accountId: ['123456789012', '987654321098'],
      },
    }).handle(async ({ accountId, resultToken }) => {
      logger.info(\`Checking cross-account access in \${accountId}\`)
      await report(accountId, true, resultToken)
    }),
  )

async function report(accountId: string, compliant: boolean, resultToken: string): Promise<void> {
  await config.send(
    new PutEvaluationsCommand({
      ResultToken: resultToken,
      Evaluations: [
        {
          ComplianceResourceType: 'AWS::::Account',
          ComplianceResourceId: accountId,
          ComplianceType: compliant ? 'COMPLIANT' : 'NON_COMPLIANT',
          OrderingTimestamp: new Date(),
        },
      ],
    }),
  )
}`},{path:"schemas/rules.ts",code:`import { z } from 'zod'

export const tagAuditParamsSchema = z.object({
  requiredTags: z.string(), // JSON-encoded array of tag keys
})`}];return(o,s)=>{const t=n("CodeFileViewer");return h(),l("div",null,[s[0]||(s[0]=r("",72)),d(t,{files:e,id:"scheduled-example","default-file":"scheduled.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("p",null,[a("The two routes match on distinct rule names, so no evaluation matches both and the order you register them in makes no difference. Each handler reports its result with the "),i("code",null,"resultToken"),a(".")],-1)),s[2]||(s[2]=i("p",null,[i("code",null,"index.ts"),a(" hands the router to "),i("code",null,"LambdaRouter"),a(", which is what AWS invokes and what every router in the Lambda gets registered on. See "),i("a",{href:"/docs/routers"},"routers"),a(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,g as default};

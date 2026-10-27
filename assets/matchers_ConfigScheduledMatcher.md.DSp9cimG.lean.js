import{C as n,o as h,c as l,ak as r,E as d,j as i,a}from"./chunks/framework.C2AAou88.js";const E=JSON.parse('{"title":"ConfigScheduledMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/ConfigScheduledMatcher.md","filePath":"matchers/ConfigScheduledMatcher.md"}'),p={name:"matchers/ConfigScheduledMatcher.md"},g=Object.assign(p,{setup(k){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { scheduledMatcher } from './scheduled.js'

const latcher = new Latcher({
  matchers: [scheduledMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"scheduled.ts",code:`import { ConfigServiceClient, PutEvaluationsCommand } from '@aws-sdk/client-config-service'
import { logger } from '@latcher/base'
import { createConfigScheduledMatcher, defineConfigScheduledRoute } from '@latcher/config'

import { tagAuditParamsSchema } from './schemas/rules.js'

const config = new ConfigServiceClient({})

export const scheduledMatcher = createConfigScheduledMatcher()

scheduledMatcher
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
})`}];return(o,s)=>{const t=n("CodeFileViewer");return h(),l("div",null,[s[0]||(s[0]=r("",74)),d(t,{files:e,id:"scheduled-example","default-file":"scheduled.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("p",null,[a("The two routes match on distinct rule names, so no evaluation matches both and the order you register them in makes no difference. Each handler reports its result with the "),i("code",null,"resultToken"),a(".")],-1)),s[2]||(s[2]=i("p",null,[i("code",null,"index.ts"),a(" hands the matcher to "),i("code",null,"Latcher"),a(", which is what AWS invokes and what every matcher in the Lambda gets registered on. See "),i("a",{href:"/latcher/docs/matchers"},"matchers"),a(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,g as default};

import{C as n,o as h,c as l,ak as r,E as p,j as s,a}from"./chunks/framework.C2AAou88.js";const g=JSON.parse('{"title":"ConfigMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/ConfigMatcher.md","filePath":"matchers/ConfigMatcher.md"}'),o={name:"matchers/ConfigMatcher.md"},E=Object.assign(o,{setup(d){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { configMatcher } from './config.js'

const latcher = new Latcher({
  matchers: [configMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"config.ts",code:`import { ConfigServiceClient, PutEvaluationsCommand } from '@aws-sdk/client-config-service'
import { logger } from '@latcher/base'
import { createConfigMatcher, defineRoute } from '@latcher/config'

import { rdsConfigSchema, tagParamsSchema } from './schemas/rules.js'

const config = new ConfigServiceClient({})

export const configMatcher = createConfigMatcher()

configMatcher
  .route(
    defineRoute({
      filters: {
        configRuleName: 'rds-encryption',
        resourceType: 'AWS::RDS::DBInstance',
        configurationItemStatus: ['OK', 'ResourceDiscovered'],
      },
      configurationSchema: rdsConfigSchema,
    }).handle(async ({ configurationItem, configurationItemSummary, resultToken }) => {
      if (!configurationItem) {
        logger.info(\`Oversized change for \${configurationItemSummary.resourceId}, skipping\`)
        return
      }
      const compliant = configurationItem.configuration.storageEncrypted
      await report(configurationItem.resourceType, configurationItem.resourceId, compliant, resultToken)
    }),
  )
  .route(
    defineRoute({
      filters: {
        configRuleName: 'required-tags',
        resourceType: 'AWS::EC2::Instance',
        configurationItemStatus: ['OK', 'ResourceDiscovered'],
      },
      ruleParametersSchema: tagParamsSchema,
    }).handle(async ({ configurationItem, ruleParameters, resultToken }) => {
      if (!configurationItem) return
      const required = JSON.parse(ruleParameters.requiredTags) as string[]
      const compliant = required.every((tag) => tag in configurationItem.tags)
      await report(configurationItem.resourceType, configurationItem.resourceId, compliant, resultToken)
    }),
  )

async function report(type: string, id: string, compliant: boolean, resultToken: string): Promise<void> {
  await config.send(
    new PutEvaluationsCommand({
      ResultToken: resultToken,
      Evaluations: [
        {
          ComplianceResourceType: type,
          ComplianceResourceId: id,
          ComplianceType: compliant ? 'COMPLIANT' : 'NON_COMPLIANT',
          OrderingTimestamp: new Date(),
        },
      ],
    }),
  )
}`},{path:"schemas/rules.ts",code:`import { z } from 'zod'

export const rdsConfigSchema = z.object({
  storageEncrypted: z.boolean(),
  engineVersion: z.string(),
})

export const tagParamsSchema = z.object({
  requiredTags: z.string(), // JSON-encoded array of tag keys
})`}];return(k,i)=>{const t=n("CodeFileViewer");return h(),l("div",null,[i[0]||(i[0]=r("",79)),p(t,{files:e,id:"config-example","default-file":"config.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),i[1]||(i[1]=s("p",null,[a("The two routes match on distinct rule names, so no change matches both and the order you register them in makes no difference. Each handler narrows on "),s("code",null,"configurationItem"),a(" so an oversized notification does not throw, and reports the result with the "),s("code",null,"resultToken"),a(".")],-1)),i[2]||(i[2]=s("p",null,[s("code",null,"index.ts"),a(" hands the matcher to "),s("code",null,"Latcher"),a(", which is what AWS invokes and what every matcher in the Lambda gets registered on. See "),s("a",{href:"/latcher/docs/matchers"},"matchers"),a(" for how the two levels of matching fit together.")],-1))])}}});export{g as __pageData,E as default};

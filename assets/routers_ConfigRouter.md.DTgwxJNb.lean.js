import{C as n,o as h,c as l,ak as r,E as o,j as s,a}from"./chunks/framework.DiNuf6zK.js";const g=JSON.parse('{"title":"ConfigRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/ConfigRouter.md","filePath":"routers/ConfigRouter.md"}'),p={name:"routers/ConfigRouter.md"},E=Object.assign(p,{setup(d){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { configRouter } from './config.js'

const lambdaRouter = new LambdaRouter({
  routers: [configRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"config.ts",code:`import { ConfigServiceClient, PutEvaluationsCommand } from '@aws-sdk/client-config-service'
import { logger } from '@lambda-event-router/base'
import { createConfigRouter, defineRoute } from '@lambda-event-router/config'

import { rdsConfigSchema, tagParamsSchema } from './schemas/rules.js'

const config = new ConfigServiceClient({})

export const configRouter = createConfigRouter()

configRouter
  .route(
    defineRoute({
      filters: { configRuleName: 'rds-encryption', resourceType: 'AWS::RDS::DBInstance' },
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
      filters: { configRuleName: 'required-tags', resourceType: 'AWS::EC2::Instance' },
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
})`}];return(k,i)=>{const t=n("CodeFileViewer");return h(),l("div",null,[i[0]||(i[0]=r("",75)),o(t,{files:e,id:"config-example","default-file":"config.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),i[1]||(i[1]=s("p",null,[a("The two routes match on distinct rule names, so no change matches both and the order you register them in makes no difference. Each handler narrows on "),s("code",null,"configurationItem"),a(" so an oversized notification does not throw, and reports the result with the "),s("code",null,"resultToken"),a(".")],-1)),i[2]||(i[2]=s("p",null,[s("code",null,"index.ts"),a(" hands the router to "),s("code",null,"LambdaRouter"),a(", which is what AWS invokes and what every router in the Lambda gets registered on. See "),s("a",{href:"/docs/routers"},"routers"),a(" for how the two levels of matching fit together.")],-1))])}}});export{g as __pageData,E as default};

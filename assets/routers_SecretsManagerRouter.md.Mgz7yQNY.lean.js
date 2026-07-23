import{C as n,o as r,c as h,a6 as l,E as d,j as e,a as t}from"./chunks/framework.DlxdiH7Q.js";const g=JSON.parse('{"title":"SecretsManagerRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/SecretsManagerRouter.md","filePath":"routers/SecretsManagerRouter.md"}'),o={name:"routers/SecretsManagerRouter.md"},E=Object.assign(o,{setup(p){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { secretsManagerRouter } from './secretsManager.js'

const lambdaRouter = new LambdaRouter({
  routers: [secretsManagerRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"secretsManager.ts",code:`import { createSecretsManagerRouter } from '@lambda-event-router/secretsmanager'

import { createSecret, finishSecret, setSecret, testSecret } from './handlers/rotation.js'

export const secretsManagerRouter = createSecretsManagerRouter()

secretsManagerRouter
  .createSecret({ filters: { secretId: 'prod/database/*' }, handler: createSecret })
  .setSecret({ filters: { secretId: 'prod/database/*' }, handler: setSecret })
  .testSecret({ filters: { secretId: 'prod/database/*' }, handler: testSecret })
  .finishSecret({ filters: { secretId: 'prod/database/*' }, handler: finishSecret })`},{path:"handlers/rotation.ts",code:`import { logger } from '@lambda-event-router/base'
import type { SecretsManagerRequest, SecretsManagerResponse } from '@lambda-event-router/secretsmanager'

export async function createSecret(
  { secretId, clientRequestToken }: SecretsManagerRequest,
): Promise<SecretsManagerResponse> {
  logger.info(\`Creating a new version of \${secretId} for token \${clientRequestToken}\`)
  // Put a new secret value in the AWSPENDING stage
}

export async function setSecret({ secretId }: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  logger.info(\`Setting the pending value of \${secretId} on the database\`)
}

export async function testSecret({ secretId }: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  logger.info(\`Testing the pending value of \${secretId}\`)
}

export async function finishSecret({ secretId }: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  logger.info(\`Promoting the pending value of \${secretId} to AWSCURRENT\`)
}`}];return(k,s)=>{const i=n("CodeFileViewer");return r(),h("div",null,[s[0]||(s[0]=l("",65)),d(i,{files:a,id:"secretsmanager-example","default-file":"secretsManager.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("p",null,[t("Each route matches a different step, so no invocation can match two and the order they register in makes no difference. The four steps run in sequence across four invocations, and each hands its handler the same "),e("code",null,"secretId"),t(" and "),e("code",null,"clientRequestToken"),t(" so it can act on the version the previous step created.")],-1)),s[2]||(s[2]=e("p",null,[e("code",null,"index.ts"),t(" hands the router to "),e("code",null,"LambdaRouter"),t(", which is what AWS invokes and what every router in the Lambda gets registered on. See "),e("a",{href:"/lambda-event-router/docs/routers"},"routers"),t(" for how the two levels of matching fit together.")],-1))])}}});export{g as __pageData,E as default};

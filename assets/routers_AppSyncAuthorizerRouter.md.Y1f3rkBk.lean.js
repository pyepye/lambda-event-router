import{C as t,o as n,c as h,ak as e,E as r}from"./chunks/framework.Ct7YXsF8.js";const k=JSON.parse('{"title":"AppSyncAuthorizerRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/AppSyncAuthorizerRouter.md","filePath":"routers/AppSyncAuthorizerRouter.md"}'),o={name:"routers/AppSyncAuthorizerRouter.md"},c=Object.assign(o,{setup(l){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { authRouter } from './authorizer.js'

const lambdaRouter = new LambdaRouter({
  routers: [authRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"authorizer.ts",code:`import { createAppSyncAuthorizerRouter } from '@lambda-event-router/appsync'

import { authoriseRequest } from './handlers/authorise.js'

export const authRouter = createAppSyncAuthorizerRouter()

authRouter.route({ handler: authoriseRequest })`},{path:"handlers/authorise.ts",code:`import type { AppSyncAuthorizerResult } from 'aws-lambda'
import type { AppSyncAuthorizerRequest } from '@lambda-event-router/appsync'
import { Authorized, Denied } from '@lambda-event-router/appsync'
import { logger } from '@lambda-event-router/base'

import { users } from '../accounts.js'

const ADMIN_ONLY_FIELDS = ['User.email', 'User.phoneNumber']

export async function authoriseRequest(
  request: AppSyncAuthorizerRequest,
): Promise<AppSyncAuthorizerResult<Record<string, unknown>>> {
  const { authorizationToken, operationName, requestId } = request

  const [scheme, token] = authorizationToken.split(' ')
  if (scheme !== 'Bearer' || !token) {
    logger.warn(\`Rejected a \${scheme} credential on request \${requestId}\`)
    return Denied()
  }

  const user = await users.fromToken(token)
  if (!user) {
    logger.warn(\`Rejected an unknown token running \${operationName}\`)
    return Denied()
  }

  // Nothing cached for a suspended account, so lifting the suspension takes effect at once
  if (user.status === 'suspended') {
    return Denied({ ttlOverride: 0 })
  }

  const resolverContext = { userId: user.id, tenantId: user.tenantId, role: user.role }

  if (user.role === 'admin') {
    return Authorized({ resolverContext, ttlOverride: 300 })
  }

  // Everyone else gets in with the personal fields blanked out
  return Authorized({ resolverContext, deniedFields: ADMIN_ONLY_FIELDS, ttlOverride: 300 })
}`},{path:"accounts.ts",code:`interface User {
  id: string
  tenantId: string
  role: 'admin' | 'member'
  status: 'active' | 'suspended'
}

export const users = {
  async fromToken(token: string): Promise<User | undefined> {
    // Verify the JWT and load whoever it belongs to
    return { id: 'user-123', tenantId: 'acme', role: 'member', status: 'active' }
  },
}`}];return(p,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",77)),r(a,{files:i,id:"appsync-authorizer-example","default-file":"handlers/authorise.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",3))])}}});export{k as __pageData,c as default};

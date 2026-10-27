import{C as t,o as n,c as h,ak as e,E as r}from"./chunks/framework.C2AAou88.js";const k=JSON.parse('{"title":"AppSyncAuthorizerMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/AppSyncAuthorizerMatcher.md","filePath":"matchers/AppSyncAuthorizerMatcher.md"}'),l={name:"matchers/AppSyncAuthorizerMatcher.md"},c=Object.assign(l,{setup(p){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { authMatcher } from './authorizer.js'

const latcher = new Latcher({
  matchers: [authMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"authorizer.ts",code:`import { createAppSyncAuthorizerMatcher } from '@latcher/appsync'

import { authoriseRequest } from './handlers/authorise.js'

export const authMatcher = createAppSyncAuthorizerMatcher()

authMatcher.route({ handler: authoriseRequest })`},{path:"handlers/authorise.ts",code:`import type { AppSyncAuthorizerResult } from 'aws-lambda'
import type { AppSyncAuthorizerRequest } from '@latcher/appsync'
import { Authorized, Denied } from '@latcher/appsync'
import { logger } from '@latcher/base'

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
}`}];return(o,s)=>{const a=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",85)),r(a,{files:i,id:"appsync-authorizer-example","default-file":"handlers/authorise.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",3))])}}});export{k as __pageData,c as default};

import{C as t,o as n,c as h,ak as e,E as r}from"./chunks/framework.Ct7YXsF8.js";const k=JSON.parse('{"title":"LambdaAuthorizerRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/LambdaAuthorizerRouter.md","filePath":"routers/LambdaAuthorizerRouter.md"}'),o={name:"routers/LambdaAuthorizerRouter.md"},c=Object.assign(o,{setup(d){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { authRouter } from './authorizer.js'

const lambdaRouter = new LambdaRouter({
  routers: [authRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"authorizer.ts",code:`import { createLambdaAuthorizerRouter, defineLambdaAuthorizerRoute } from '@lambda-event-router/apigateway'

import { authoriseRead, authoriseToken, authoriseWrite } from './handlers/auth.js'

export const authRouter = createLambdaAuthorizerRouter()

authRouter
  .token({ handler: authoriseToken })
  .request({ method: 'GET', handler: authoriseRead })
  .route(
    defineLambdaAuthorizerRoute({
      filters: {
        type: 'REQUEST',
        custom: ({ method }) => method !== 'GET',
      },
    }).handle(authoriseWrite),
  )`},{path:"handlers/auth.ts",code:`import type { APIGatewayAuthorizerResult } from 'aws-lambda'
import type {
  LambdaAuthorizerRequestRequest,
  LambdaAuthorizerTokenRequest,
} from '@lambda-event-router/apigateway'
import { Allow, Deny } from '@lambda-event-router/apigateway'
import { logger } from '@lambda-event-router/base'

import { apiKeys, users } from '../accounts.js'

export async function authoriseToken(request: LambdaAuthorizerTokenRequest): Promise<APIGatewayAuthorizerResult> {
  const { authorizationToken, resourceArn } = request

  const [scheme, token] = authorizationToken.split(' ')
  if (scheme !== 'Bearer' || !token) {
    logger.warn(\`Rejected a \${scheme} credential on \${resourceArn}\`)
    return Deny('anonymous', resourceArn)
  }

  const user = await users.fromToken(token)
  if (!user) {
    return Deny('anonymous', resourceArn)
  }

  return Allow(user.id, resourceArn, { tenantId: user.tenantId })
}

export async function authoriseRead(request: LambdaAuthorizerRequestRequest): Promise<APIGatewayAuthorizerResult> {
  const { headers, path, resourceArn } = request

  const client = await apiKeys.lookup(headers['x-api-key'])
  if (!client) {
    logger.warn(\`Rejected an API key reading \${path}\`)
    return Deny('anonymous', resourceArn)
  }

  return Allow(client.id, resourceArn, { tenantId: client.tenantId, plan: client.plan })
}

export async function authoriseWrite(request: LambdaAuthorizerRequestRequest): Promise<APIGatewayAuthorizerResult> {
  const { headers, method, path, resourceArn } = request

  const client = await apiKeys.lookup(headers['x-api-key'])
  if (!client) {
    logger.warn(\`Rejected an API key on \${method} \${path}\`)
    return Deny('anonymous', resourceArn)
  }

  // Reads are open to every plan, writes are not
  if (client.plan === 'free') {
    logger.info(\`Client \${client.id} is on the free plan and cannot \${method}\`)
    return Deny(client.id, resourceArn)
  }

  return Allow(client.id, resourceArn, { tenantId: client.tenantId, plan: client.plan })
}`},{path:"accounts.ts",code:`interface User {
  id: string
  tenantId: string
}

interface Client {
  id: string
  tenantId: string
  plan: 'free' | 'pro'
}

export const users = {
  async fromToken(token: string): Promise<User | undefined> {
    // Verify the JWT and load whoever it belongs to
    return { id: 'user-123', tenantId: 'acme' }
  },
}

export const apiKeys = {
  async lookup(key: string | undefined): Promise<Client | undefined> {
    if (!key) return undefined

    // Look the key up in whatever holds them
    return { id: 'client-456', tenantId: 'acme', plan: 'pro' }
  },
}`}];return(l,s)=>{const i=t("CodeFileViewer");return n(),h("div",null,[s[0]||(s[0]=e("",93)),r(i,{files:a,id:"authorizer-example","default-file":"authorizer.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("",4))])}}});export{k as __pageData,c as default};

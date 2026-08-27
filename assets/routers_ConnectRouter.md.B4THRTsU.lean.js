import{C as n,o as h,c as o,ak as l,E as d,j as t,a as e}from"./chunks/framework.Ct7YXsF8.js";const E=JSON.parse('{"title":"ConnectRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/ConnectRouter.md","filePath":"routers/ConnectRouter.md"}'),r={name:"routers/ConnectRouter.md"},g=Object.assign(r,{setup(p){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { connectRouter } from './connect.js'

const lambdaRouter = new LambdaRouter({
  routers: [connectRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"connect.ts",code:`import { createConnectRouter } from '@lambda-event-router/connect'

import { defaultContact, greetInboundCaller, handleChat, handleEmail } from './handlers/contacts.js'

export const connectRouter = createConnectRouter()

connectRouter
  .voice({
    filters: { initiationMethod: 'INBOUND' },
    handler: greetInboundCaller,
  })
  .chat({ filters: {}, handler: handleChat })
  .email({ filters: {}, handler: handleEmail })
  .route({ filters: {}, handler: defaultContact })`},{path:"handlers/contacts.ts",code:`import { logger } from '@lambda-event-router/base'
import type { ConnectRequest, ConnectResponse } from '@lambda-event-router/connect'

export async function greetInboundCaller({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(\`Inbound voice contact \${contactData.ContactId} from \${contactData.CustomerEndpoint?.Address}\`)
  return { greeting: 'Welcome back', queue: 'sales' }
}

export async function handleChat({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(\`Chat contact \${contactData.ContactId}\`)
  return { greeting: 'How can we help?' }
}

export async function handleEmail({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(\`Email contact \${contactData.ContactId}\`)
  return { acknowledged: 'true' }
}

export async function defaultContact({ contactData }: ConnectRequest): Promise<ConnectResponse> {
  logger.info(\`Unrouted \${contactData.Channel} contact \${contactData.ContactId}\`)
  return {}
}`}];return(c,s)=>{const i=n("CodeFileViewer");return h(),o("div",null,[s[0]||(s[0]=l("",66)),d(i,{files:a,id:"connect-example","default-file":"connect.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=t("p",null,[e("The first three routes match a distinct channel, so no contact reaches two of them and the order they register in makes no difference. "),t("code",null,"defaultContact"),e(" filters on nothing, so it has to come last, and it catches anything the others miss, such as an outbound voice call.")],-1)),s[2]||(s[2]=t("p",null,[t("code",null,"index.ts"),e(" hands the router to "),t("code",null,"LambdaRouter"),e(", which is what AWS invokes and what every router in the Lambda gets registered on. See "),t("a",{href:"/lambda-event-router/docs/routers"},"routers"),e(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,g as default};

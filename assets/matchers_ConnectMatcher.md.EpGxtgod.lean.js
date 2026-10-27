import{C as n,o as h,c as l,ak as o,E as d,j as e,a as t}from"./chunks/framework.C2AAou88.js";const E=JSON.parse('{"title":"ConnectMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/ConnectMatcher.md","filePath":"matchers/ConnectMatcher.md"}'),r={name:"matchers/ConnectMatcher.md"},g=Object.assign(r,{setup(c){const a=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { connectMatcher } from './connect.js'

const latcher = new Latcher({
  matchers: [connectMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"connect.ts",code:`import { createConnectMatcher } from '@latcher/connect'

import { defaultContact, greetInboundCaller, handleChat, handleEmail } from './handlers/contacts.js'

export const connectMatcher = createConnectMatcher()

connectMatcher
  .voice({
    filters: { initiationMethod: 'INBOUND' },
    handler: greetInboundCaller,
  })
  .chat({ filters: {}, handler: handleChat })
  .email({ filters: {}, handler: handleEmail })
  .route({ filters: {}, handler: defaultContact })`},{path:"handlers/contacts.ts",code:`import { logger } from '@latcher/base'
import type { ConnectRequest, ConnectResponse } from '@latcher/connect'

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
}`}];return(p,s)=>{const i=n("CodeFileViewer");return h(),l("div",null,[s[0]||(s[0]=o("",67)),d(i,{files:a,id:"connect-example","default-file":"connect.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=e("p",null,[t("The first three routes match a distinct channel, so no contact reaches two of them and the order they register in makes no difference. "),e("code",null,"defaultContact"),t(" filters on nothing, so it has to come last, and it catches anything the others miss, such as an outbound voice call.")],-1)),s[2]||(s[2]=e("p",null,[e("code",null,"index.ts"),t(" hands the matcher to "),e("code",null,"Latcher"),t(", which is what AWS invokes and what every matcher in the Lambda gets registered on. See "),e("a",{href:"/latcher/docs/matchers"},"matchers"),t(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,g as default};

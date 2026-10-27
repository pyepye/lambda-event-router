import{C as h,o as n,c as l,ak as o,E as d,j as a,a as i}from"./chunks/framework.C2AAou88.js";const g=JSON.parse('{"title":"CloudWatchLogsMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/CloudWatchLogsMatcher.md","filePath":"matchers/CloudWatchLogsMatcher.md"}'),r={name:"matchers/CloudWatchLogsMatcher.md"},E=Object.assign(r,{setup(p){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { cloudWatchLogsMatcher } from './cloudwatch.js'

const latcher = new Latcher({
  matchers: [cloudWatchLogsMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"cloudwatch.ts",code:`import { createCloudWatchLogsMatcher } from '@latcher/cloudwatch'

import { handleControlMessage, handleEcsLogs, handleLambdaLogs } from './handlers/logs.js'

export const cloudWatchLogsMatcher = createCloudWatchLogsMatcher()

cloudWatchLogsMatcher
  .dataMessage({
    filters: { logGroup: '/aws/lambda/*' },
    handler: handleLambdaLogs,
  })
  .dataMessage({
    filters: { logGroup: '/aws/ecs/*' },
    handler: handleEcsLogs,
  })
  .controlMessage({
    filters: {},
    handler: handleControlMessage,
  })`},{path:"handlers/logs.ts",code:`import { logger } from '@latcher/base'
import type { CloudWatchLogsRequest } from '@latcher/cloudwatch'

export async function handleLambdaLogs({ logGroup, logEvents }: CloudWatchLogsRequest): Promise<void> {
  logger.info(\`\${logEvents.length} Lambda log events from \${logGroup}\`)
}

export async function handleEcsLogs({ logGroup, logEvents }: CloudWatchLogsRequest): Promise<void> {
  logger.info(\`\${logEvents.length} ECS log events from \${logGroup}\`)
}

export async function handleControlMessage({ logGroup }: CloudWatchLogsRequest): Promise<void> {
  logger.info(\`Subscription reachable for \${logGroup}\`)
}`}];return(k,s)=>{const t=h("CodeFileViewer");return n(),l("div",null,[s[0]||(s[0]=o("",66)),d(t,{files:e,id:"cloudwatch-example","default-file":"cloudwatch.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=a("p",null,"The two data routes match different log group patterns and the control route matches a different message type, so no delivery can match two and the order you register them in makes no difference. A subscription only delivers from the log groups you attach it to, so these three routes cover every delivery the function can receive.",-1)),s[2]||(s[2]=a("p",null,[a("code",null,"index.ts"),i(" hands the matcher to "),a("code",null,"Latcher"),i(", which is what AWS invokes and what every matcher in the Lambda gets registered on. See "),a("a",{href:"/latcher/docs/matchers"},"matchers"),i(" for how the two levels of matching fit together.")],-1))])}}});export{g as __pageData,E as default};

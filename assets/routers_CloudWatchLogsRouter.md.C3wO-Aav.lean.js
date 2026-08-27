import{C as n,o as h,c as l,ak as o,E as d,j as a,a as e}from"./chunks/framework.Ct7YXsF8.js";const g=JSON.parse('{"title":"CloudWatchLogsRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/CloudWatchLogsRouter.md","filePath":"routers/CloudWatchLogsRouter.md"}'),r={name:"routers/CloudWatchLogsRouter.md"},E=Object.assign(r,{setup(p){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { cloudWatchLogsRouter } from './cloudwatch.js'

const lambdaRouter = new LambdaRouter({
  routers: [cloudWatchLogsRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"cloudwatch.ts",code:`import { createCloudWatchLogsRouter } from '@lambda-event-router/cloudwatch'

import { handleControlMessage, handleEcsLogs, handleLambdaLogs } from './handlers/logs.js'

export const cloudWatchLogsRouter = createCloudWatchLogsRouter()

cloudWatchLogsRouter
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
  })`},{path:"handlers/logs.ts",code:`import { logger } from '@lambda-event-router/base'
import type { CloudWatchLogsRequest } from '@lambda-event-router/cloudwatch'

export async function handleLambdaLogs({ logGroup, logEvents }: CloudWatchLogsRequest): Promise<void> {
  logger.info(\`\${logEvents.length} Lambda log events from \${logGroup}\`)
}

export async function handleEcsLogs({ logGroup, logEvents }: CloudWatchLogsRequest): Promise<void> {
  logger.info(\`\${logEvents.length} ECS log events from \${logGroup}\`)
}

export async function handleControlMessage({ logGroup }: CloudWatchLogsRequest): Promise<void> {
  logger.info(\`Subscription reachable for \${logGroup}\`)
}`}];return(k,s)=>{const t=n("CodeFileViewer");return h(),l("div",null,[s[0]||(s[0]=o("",65)),d(t,{files:i,id:"cloudwatch-example","default-file":"cloudwatch.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=a("p",null,"The two data routes match different log group patterns and the control route matches a different message type, so no delivery can match two and the order you register them in makes no difference. A subscription only delivers from the log groups you attach it to, so these three routes cover every delivery the function can receive.",-1)),s[2]||(s[2]=a("p",null,[a("code",null,"index.ts"),e(" hands the router to "),a("code",null,"LambdaRouter"),e(", which is what AWS invokes and what every router in the Lambda gets registered on. See "),a("a",{href:"/lambda-event-router/docs/routers"},"routers"),e(" for how the two levels of matching fit together.")],-1))])}}});export{g as __pageData,E as default};

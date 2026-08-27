import{C as n,o as h,c as r,ak as p,E as l,j as i,a}from"./chunks/framework.DiNuf6zK.js";const E=JSON.parse('{"title":"StepFunctionsRouter","description":"","frontmatter":{},"headers":[],"relativePath":"routers/StepFunctionsRouter.md","filePath":"routers/StepFunctionsRouter.md"}'),k={name:"routers/StepFunctionsRouter.md"},g=Object.assign(k,{setup(d){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { stepFunctionsRouter } from './stepFunctions.js'

const lambdaRouter = new LambdaRouter({
  routers: [stepFunctionsRouter],
})

export const handler: Handler = lambdaRouter.handler()`},{path:"stepFunctions.ts",code:`import { isObject } from '@lambda-event-router/base'
import { createStepFunctionsRouter } from '@lambda-event-router/stepfunctions'

import { processOrder, requestApproval } from './handlers/tasks.js'
import { ApprovalSchema, OrderSchema } from './schemas/tasks.js'

export const stepFunctionsRouter = createStepFunctionsRouter()

stepFunctionsRouter
  .route({
    filters: { custom: ({ event }) => isObject(event) && event.taskType === 'processOrder' },
    eventSchema: OrderSchema,
    handler: processOrder,
  })
  .route({
    filters: {
      taskToken: true,
      custom: ({ event }) => isObject(event) && event.taskType === 'humanApproval',
    },
    eventSchema: ApprovalSchema,
    handler: requestApproval,
  })`},{path:"handlers/tasks.ts",code:`import { logger } from '@lambda-event-router/base'
import type { StepFunctionsRequest, StepFunctionsTaskTokenRequest } from '@lambda-event-router/stepfunctions'

import type { Approval, Order } from '../schemas/tasks.js'

export async function processOrder({ event }: StepFunctionsRequest<Order>): Promise<{ orderId: string; status: string }> {
  logger.info(\`Processing order \${event.orderId}\`)
  return { orderId: event.orderId, status: 'processed' }
}

export async function requestApproval(
  { taskToken, input }: StepFunctionsTaskTokenRequest<Approval>,
): Promise<void> {
  logger.info(\`Approval \${input.requestId} from \${input.requester} needs sign-off\`)
  // Store taskToken, then later: sfn.sendTaskSuccess({ taskToken, output }) once signed off
}`},{path:"schemas/tasks.ts",code:`import { z } from 'zod'

export const OrderSchema = z.object({
  taskType: z.literal('processOrder'),
  orderId: z.string(),
})

export const ApprovalSchema = z.object({
  taskType: z.literal('humanApproval'),
  requestId: z.string(),
  requester: z.string(),
})

export type Order = z.infer<typeof OrderSchema>
export type Approval = z.infer<typeof ApprovalSchema>`}];return(o,s)=>{const t=n("CodeFileViewer");return h(),r("div",null,[s[0]||(s[0]=p("",77)),l(t,{files:e,id:"stepfunctions-example","default-file":"stepFunctions.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("p",null,[a("Each route matches a different "),i("code",null,"taskType"),a(", so no task reaches two and the order they register in makes no difference between them. This Lambda only handles Step Functions tasks, so there is no other router for a task to fall through to.")],-1)),s[2]||(s[2]=i("p",null,[i("code",null,"index.ts"),a(" hands the router to "),i("code",null,"LambdaRouter"),a(", which is what AWS invokes and what every router in the Lambda gets registered on. See "),i("a",{href:"/docs/routers"},"routers"),a(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,g as default};

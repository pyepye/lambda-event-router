import{C as n,o as h,c as p,ak as l,E as r,j as i,a}from"./chunks/framework.C2AAou88.js";const E=JSON.parse('{"title":"StepFunctionsMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/StepFunctionsMatcher.md","filePath":"matchers/StepFunctionsMatcher.md"}'),k={name:"matchers/StepFunctionsMatcher.md"},g=Object.assign(k,{setup(d){const e=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { stepFunctionsMatcher } from './stepFunctions.js'

const latcher = new Latcher({
  matchers: [stepFunctionsMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"stepFunctions.ts",code:`import { isObject } from '@latcher/base'
import { createStepFunctionsMatcher } from '@latcher/stepfunctions'

import { processOrder, requestApproval } from './handlers/tasks.js'
import { ApprovalSchema, OrderSchema } from './schemas/tasks.js'

export const stepFunctionsMatcher = createStepFunctionsMatcher()

stepFunctionsMatcher
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
  })`},{path:"handlers/tasks.ts",code:`import { logger } from '@latcher/base'
import type { StepFunctionsRequest, StepFunctionsTaskTokenRequest } from '@latcher/stepfunctions'

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
export type Approval = z.infer<typeof ApprovalSchema>`}];return(o,s)=>{const t=n("CodeFileViewer");return h(),p("div",null,[s[0]||(s[0]=l("",82)),r(t,{files:e,id:"stepfunctions-example","default-file":"stepFunctions.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),s[1]||(s[1]=i("p",null,[a("Each route matches a different "),i("code",null,"taskType"),a(", so no task reaches two and the order they register in makes no difference between them. This Lambda only handles Step Functions tasks, so there is no other matcher for a task to fall through to.")],-1)),s[2]||(s[2]=i("p",null,[i("code",null,"index.ts"),a(" hands the matcher to "),i("code",null,"Latcher"),a(", which is what AWS invokes and what every matcher in the Lambda gets registered on. See "),i("a",{href:"/latcher/docs/matchers"},"matchers"),a(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,g as default};

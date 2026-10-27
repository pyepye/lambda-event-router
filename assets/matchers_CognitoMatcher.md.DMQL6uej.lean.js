import{C as n,o as r,c as h,ak as o,E as d,j as e,a as s}from"./chunks/framework.C2AAou88.js";const g=JSON.parse('{"title":"CognitoMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/CognitoMatcher.md","filePath":"matchers/CognitoMatcher.md"}'),l={name:"matchers/CognitoMatcher.md"},E=Object.assign(l,{setup(p){const i=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { cognitoMatcher } from './cognito.js'

const latcher = new Latcher({
  matchers: [cognitoMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"cognito.ts",code:`import { createCognitoMatcher } from '@latcher/cognito'

import { addRoleClaim, allowSignUp, provisionUser } from './handlers/lifecycle.js'
import { UserAttributesSchema } from './schemas/userAttributes.js'

export const cognitoMatcher = createCognitoMatcher()

cognitoMatcher
  .preSignUp({ handler: allowSignUp })
  .postConfirmation({
    userAttributesSchema: UserAttributesSchema,
    handler: provisionUser,
  })
  .preTokenGeneration({ handler: addRoleClaim })`},{path:"handlers/lifecycle.ts",code:`import { logger } from '@latcher/base'
import type { PreSignUpRequest, PostConfirmationRequest, PreTokenGenerationRequest } from '@latcher/cognito'
import type { PreSignUpTriggerEvent, PostConfirmationTriggerEvent, PreTokenGenerationTriggerEvent } from 'aws-lambda'

import type { UserAttributes } from '../schemas/userAttributes.js'

export async function allowSignUp({ event, userAttributes }: PreSignUpRequest): Promise<PreSignUpTriggerEvent> {
  if (userAttributes.email?.endsWith('@enroly.com')) {
    event.response.autoConfirmUser = true
    event.response.autoVerifyEmail = true
  }
  return event
}

export async function provisionUser(
  { event, userAttributes }: PostConfirmationRequest<UserAttributes>,
): Promise<PostConfirmationTriggerEvent> {
  logger.info(\`Provisioning \${userAttributes.email}\`)
  return event
}

export async function addRoleClaim({ event }: PreTokenGenerationRequest): Promise<PreTokenGenerationTriggerEvent> {
  event.response.claimsOverrideDetails = {
    claimsToAddOrOverride: { role: 'applicant' },
  }
  return event
}`},{path:"schemas/userAttributes.ts",code:`import { z } from 'zod'

export const UserAttributesSchema = z.object({
  email: z.string().email(),
  name: z.string(),
})

export type UserAttributes = z.infer<typeof UserAttributesSchema>`}];return(c,t)=>{const a=n("CodeFileViewer");return r(),h("div",null,[t[0]||(t[0]=o("",84)),d(a,{files:i,id:"cognito-example","default-file":"cognito.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),t[1]||(t[1]=e("p",null,[s("Each route filters on a different trigger, so no event can match two and the order they register in makes no difference. "),e("code",null,"provisionUser"),s(" reads a validated "),e("code",null,"userAttributes"),s(", so its schema is attached on the same route.")],-1)),t[2]||(t[2]=e("p",null,[e("code",null,"index.ts"),s(" hands the matcher to "),e("code",null,"Latcher"),s(", which is what AWS invokes and what every matcher in the Lambda gets registered on. See "),e("a",{href:"/latcher/docs/matchers"},"matchers"),s(" for how the two levels of matching fit together.")],-1))])}}});export{g as __pageData,E as default};

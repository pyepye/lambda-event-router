import{C as n,o as h,c as l,ak as d,E as o,j as s,a as e}from"./chunks/framework.C2AAou88.js";const E=JSON.parse('{"title":"LexMatcher","description":"","frontmatter":{},"headers":[],"relativePath":"matchers/LexMatcher.md","filePath":"matchers/LexMatcher.md"}'),r={name:"matchers/LexMatcher.md"},g=Object.assign(r,{setup(p){const t=[{path:"index.ts",code:`import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { lexMatcher } from './lex.js'

const latcher = new Latcher({
  matchers: [lexMatcher],
})

export const handler: Handler = latcher.handler()`},{path:"lex.ts",code:`import { createLexMatcher } from '@latcher/lex'

import { elicitIntent, gatherPizzaSlots, placePizzaOrder } from './handlers/pizza.js'

export const lexMatcher = createLexMatcher()

lexMatcher
  .dialogCodeHook({
    filters: { intentName: 'OrderPizza' },
    handler: gatherPizzaSlots,
  })
  .fulfillmentCodeHook({
    filters: { intentName: 'OrderPizza' },
    handler: placePizzaOrder,
  })
  .route({ filters: {}, handler: elicitIntent })`},{path:"handlers/pizza.ts",code:`import { logger } from '@latcher/base'
import type { LexDialogCodeHookRequest, LexFulfillmentCodeHookRequest, LexRequest, LexResponse } from '@latcher/lex'

export async function gatherPizzaSlots(
  { intentName, slots }: LexDialogCodeHookRequest,
): Promise<LexResponse> {
  logger.info(\`Gathering slots for \${intentName}: \${JSON.stringify(slots)}\`)
  if (!slots.PizzaSize) {
    return {
      sessionState: {
        dialogAction: { type: 'ElicitSlot', slotToElicit: 'PizzaSize' },
        intent: { name: intentName, state: 'InProgress' },
      },
      messages: [{ contentType: 'PlainText', content: 'What size would you like?' }],
    }
  }
  return {
    sessionState: {
      dialogAction: { type: 'Delegate' },
      intent: { name: intentName, state: 'InProgress' },
    },
  }
}

export async function placePizzaOrder(
  { intentName, slots }: LexFulfillmentCodeHookRequest,
): Promise<LexResponse> {
  logger.info(\`Placing \${intentName} order: \${JSON.stringify(slots)}\`)
  return {
    sessionState: {
      dialogAction: { type: 'Close' },
      intent: { name: intentName, state: 'Fulfilled' },
    },
    messages: [{ contentType: 'PlainText', content: 'Your pizza is on its way!' }],
  }
}

export async function elicitIntent({ intentName }: LexRequest): Promise<LexResponse> {
  logger.info(\`Unrouted intent \${intentName}\`)
  return {
    sessionState: { dialogAction: { type: 'ElicitIntent' } },
    messages: [{ contentType: 'PlainText', content: 'Sorry, what would you like to order?' }],
  }
}`}];return(k,i)=>{const a=n("CodeFileViewer");return h(),l("div",null,[i[0]||(i[0]=d("",67)),o(a,{files:t,id:"lex-example","default-file":"lex.ts","line-numbers":"","collapse-toggle":"","fixed-height":""}),i[1]||(i[1]=s("p",null,[e("The two "),s("code",null,"OrderPizza"),e(" routes match a different hook, so no turn reaches both and the order they register in makes no difference. "),s("code",null,"elicitIntent"),e(" filters on nothing, so it has to come last, and it catches any other intent Lex sends.")],-1)),i[2]||(i[2]=s("p",null,[s("code",null,"index.ts"),e(" hands the matcher to "),s("code",null,"Latcher"),e(", which is what AWS invokes and what every matcher in the Lambda gets registered on. See "),s("a",{href:"/latcher/docs/matchers"},"matchers"),e(" for how the two levels of matching fit together.")],-1))])}}});export{E as __pageData,g as default};

# @lambda-event-router/lex

Amazon Lex V2 dialog and fulfillment code hook routing.

**Supported AWS Services:** `Amazon Lex`

**Available Routers:** `LexRouter`

## Install

```bash
npm install @lambda-event-router/lex
```


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { lexRouter } from './lex'

const lambdaRouter = new LambdaRouter({
  routers: [lexRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// lex.ts
import { createLexRouter, defineRoute } from '@lambda-event-router/lex'

const lexRouter = createLexRouter()

// Inline functions allows Typescript to automatic infer types
const handleFulfillment = defineRoute({
  filters: {
    invocationSource: 'FulfillmentCodeHook',
  },
}).handle(async ({ sessionState, inputTranscript }) => {
  console.log(`Fulfilling: ${inputTranscript}`)
})
lexRouter.route(handleFulfillment)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// lex.ts
import { createLexRouter } from '@lambda-event-router/lex'

const lexRouter = createLexRouter()

// Separate handler to define routes and handlers in different places
lexRouter.fulfillmentCodeHook({
  handler: handleFulfillment,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function handleFulfillment({ sessionState, inputTranscript }) {
  console.log(`Fulfilling: ${inputTranscript}`)
}
```


## Usage

#### Inline handlers

```ts
import { createLexRouter, defineRoute } from '@lambda-event-router/lex'

const lexRouter = createLexRouter()

const handleFulfillment = defineRoute({
  filters: {
    invocationSource: 'FulfillmentCodeHook',
  },
}).handle(async ({ sessionState, inputTranscript }) => {
  console.log(`Fulfilling: ${inputTranscript}`)
})

lexRouter.route(handleFulfillment)
```

#### Separate handlers

```ts
import { createLexRouter } from '@lambda-event-router/lex'

const lexRouter = createLexRouter()

lexRouter.fulfillmentCodeHook({
  handler: handleFulfillment,
})

async function handleFulfillment({ sessionState, inputTranscript }) {
  console.log(`Fulfilling: ${inputTranscript}`)
}
```

#### Helper methods

```ts
lexRouter.dialogCodeHook()
lexRouter.fulfillmentCodeHook()
```

#### Filters

```ts
defineRoute({
  filters: {
    inputMode: ['Text', 'Speech'],
    invocationSource: ['DialogCodeHook', 'FulfillmentCodeHook'],
    customFilter: ({ sessionState }) => sessionState.intent.name === 'OrderPizza',
  },
})
```

## Examples

See the [examples/lex](../../examples/lex) directory for complete working examples.

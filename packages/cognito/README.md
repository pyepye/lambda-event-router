# @lambda-event-router/cognito

Routes Cognito User Pool triggers to a handler for each trigger source, such as PreSignUp or PostAuthentication. Your handler gets the event to change and return.

**Supported AWS Services:** `Amazon Cognito`

**Available Routers:** `CognitoRouter`

**Docs:** [CognitoRouter](https://pyepye.github.io/lambda-event-router/routers/CognitoRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/cognito
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { cognitoRouter } from './cognito'

const lambdaRouter = new LambdaRouter({
  routers: [cognitoRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// cognito.ts
import { createCognitoRouter, defineRoute } from '@lambda-event-router/cognito'

export const cognitoRouter = createCognitoRouter()

const autoConfirm = defineRoute({
  filters: {
    triggerSource: 'PreSignUp_SignUp',
    userPoolId: 'eu-west-2_aBcDeFgHi',
    clientId: 'web-client-id',
    userAttributes: { email: '*@example.com' },
  },
}).handle(async ({ event }) => {
  console.log(`Auto-confirming ${event.userName}`)
  event.response.autoConfirmUser = true
  return event
})

cognitoRouter.preSignUp(autoConfirm)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/CognitoRouter#annotated-handlers).

## Documentation

- [CognitoRouter](https://pyepye.github.io/lambda-event-router/routers/CognitoRouter) covers every filter, schema validation, responses
  and trigger sources.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/cognito](../../service-examples/cognito) for a deployable app.

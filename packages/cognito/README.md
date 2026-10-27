# @latcher/cognito

Routes Cognito User Pool triggers to a handler for each trigger source, such as PreSignUp or PostAuthentication. Your handler gets the event to change and return.

**Supported AWS Services:** `Amazon Cognito`

**Available Matchers:** `CognitoMatcher`

**Docs:** [CognitoMatcher](https://pyepye.github.io/latcher/matchers/CognitoMatcher)

## Install

```bash
npm install @latcher/base @latcher/cognito
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { cognitoMatcher } from './cognito'

const latcher = new Latcher({
  matchers: [cognitoMatcher],
})

export const handler = latcher.handler()
```

```ts
// cognito.ts
import { createCognitoMatcher, defineRoute } from '@latcher/cognito'

export const cognitoMatcher = createCognitoMatcher()

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

cognitoMatcher.preSignUp(autoConfirm)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/CognitoMatcher#annotated-handlers).

## Documentation

- [CognitoMatcher](https://pyepye.github.io/latcher/matchers/CognitoMatcher) covers every filter, schema validation, responses
  and trigger sources.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/cognito](../../service-examples/cognito) for a deployable app.

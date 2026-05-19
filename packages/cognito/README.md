# @lambda-event-router/cognito

Cognito User Pool trigger routing with typed methods for each trigger source (PreSignUp, PostAuth, CustomMessage, etc.).

**Supported AWS Services:** `Amazon Cognito`

**Available Routers:** `CognitoRouter`

## Install

```bash
npm install @lambda-event-router/cognito
```


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { cognitoRouter } from './cognito'

const lambdaRouter = new LambdaRouter({
  routers: [cognitoRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// cognito.ts
import { createCognitoRouter, defineRoute } from '@lambda-event-router/cognito'

const cognitoRouter = createCognitoRouter()

// Inline functions let TypeScript infer the types
const handlePreSignUp = defineRoute({
  filters: {
    triggerSource: 'PreSignUp_SignUp',
  },
}).handle(async ({ event }) => {
  console.log(`Pre-signup: ${event.userName}`)
  event.response.autoConfirmUser = true
  return event
})
cognitoRouter.route(handlePreSignUp)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// cognito.ts
import { createCognitoRouter } from '@lambda-event-router/cognito'
import type { PreSignUpRequest } from '@lambda-event-router/cognito'
import type { PreSignUpTriggerEvent } from 'aws-lambda'

const cognitoRouter = createCognitoRouter()

// Separate handler to define routes and handlers in different places
cognitoRouter.preSignUp({
  handler: handlePreSignUp,
})

// A separate handler needs its request type annotated
export async function handlePreSignUp({ event }: PreSignUpRequest): Promise<PreSignUpTriggerEvent> {
  console.log(`Pre-signup: ${event.userName}`)
  event.response.autoConfirmUser = true
  return event
}
```


## Usage

#### Inline handlers

```ts
import { createCognitoRouter, defineRoute } from '@lambda-event-router/cognito'

const cognitoRouter = createCognitoRouter()

const handlePreSignUp = defineRoute({
  filters: {
    triggerSource: 'PreSignUp_SignUp',
  },
}).handle(async ({ event }) => {
  event.response.autoConfirmUser = true
  event.response.autoVerifyEmail = true
  return event
})

cognitoRouter.route(handlePreSignUp)
```

#### Separate handlers

```ts
import { createCognitoRouter } from '@lambda-event-router/cognito'
import type { PreSignUpRequest } from '@lambda-event-router/cognito'
import type { PreSignUpTriggerEvent } from 'aws-lambda'

const cognitoRouter = createCognitoRouter()

cognitoRouter.preSignUp({
  filters: {
    triggerSource: 'PreSignUp_SignUp',
    custom: ({ callerContext }) => callerContext.clientId === 'enterprise-client-id',
  },
  handler: handlePreSignUp,
})

async function handlePreSignUp({ event }: PreSignUpRequest): Promise<PreSignUpTriggerEvent> {
  event.response.autoConfirmUser = true
  event.response.autoVerifyEmail = true
  return event
}
```

#### Helper methods

```ts
// PreSignUp triggers
cognitoRouter.preSignUp()
cognitoRouter.preSignUpSignUp()
cognitoRouter.preSignUpAdminCreateUser()

// Authentication
cognitoRouter.preAuthentication()
cognitoRouter.postAuthentication()

// Confirmation
cognitoRouter.postConfirmation()

// Custom auth challenges
cognitoRouter.defineAuthChallenge()
cognitoRouter.createAuthChallenge()
cognitoRouter.verifyAuthChallengeResponse()

// Messages and tokens
cognitoRouter.customMessage()
cognitoRouter.preTokenGeneration()

// Migration
cognitoRouter.userMigration()
```

#### Filters with trigger sources

```ts
cognitoRouter.preSignUp({
  filters: {
    triggerSource: 'PreSignUp_SignUp',
    custom: ({ callerContext }) => callerContext.clientId === 'enterprise-client-id',
  },
  handler: async ({ event }) => {
    event.response.autoConfirmUser = true
    event.response.autoVerifyEmail = true
    return event
  },
})
```

#### User attributes schema

```ts
const UserAttributesSchema = z.object({
  email: z.string(),
  name: z.string(),
})

cognitoRouter.postConfirmation({
  userAttributesSchema: UserAttributesSchema,
  handler: async ({ event, userAttributes }) => {
    console.log(`Confirmed: ${userAttributes.email}`)
    return event
  },
})
```

## Examples

See the [examples/cognito](../../examples/cognito) directory for complete working examples.

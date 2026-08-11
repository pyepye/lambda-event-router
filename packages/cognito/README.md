# @lambda-event-router/cognito

Routes Cognito User Pool triggers to a handler for each trigger source, such as PreSignUp or PostAuthentication. Your handler gets the event to change and return.

**Supported AWS Services:** `Amazon Cognito`

**Available Routers:** `CognitoRouter`

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
  routers: [cognitoRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// cognito.ts
import { createCognitoRouter, defineRoute } from '@lambda-event-router/cognito'

const cognitoRouter = createCognitoRouter()

// An inferred handler takes its types from the route
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

Or use an annotated handler, which names its types rather than inferring them:

```ts
// cognito.ts
import { createCognitoRouter } from '@lambda-event-router/cognito'
import type { PreSignUpRequest } from '@lambda-event-router/cognito'
import type { PreSignUpTriggerEvent } from 'aws-lambda'

const cognitoRouter = createCognitoRouter()

cognitoRouter.preSignUp({
  handler: handlePreSignUp,
})

// An annotated handler names its own types
export async function handlePreSignUp({ event }: PreSignUpRequest): Promise<PreSignUpTriggerEvent> {
  console.log(`Pre-signup: ${event.userName}`)
  event.response.autoConfirmUser = true
  return event
}
```


## Usage

#### Inferred handlers

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

#### Annotated handlers

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

#### Middleware

Register middleware on the router to cover every route, or on a single route. Type route middleware to
the route's schema, so `CognitoMiddleware<Attributes>` rather than `CognitoMiddleware`.

```ts
import type { CognitoMiddleware } from '@lambda-event-router/cognito'

const withTenant: CognitoMiddleware<Attributes> = async (request, next) => {
  console.log(`Tenant ${request.userAttributes['custom:tenantId']}`)
  return next(request)
}
```

## Examples

See the [service-examples/cognito](../../service-examples/cognito) directory for complete working examples.

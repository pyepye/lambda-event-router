# CognitoMatcher

`CognitoMatcher` routes Amazon Cognito User Pool triggers to handlers, one event per invocation.

Cognito calls your Lambda at points in a user's lifecycle: signing up, authenticating, generating
tokens, migrating from an old system. Each call carries a single event with a `triggerSource` naming
the point that fired. The matcher matches on that source and hands your handler the event to change and
hand back.

## Install

```bash
npm install @latcher/base @latcher/cognito
```

`@latcher/base` is a peer dependency, so install it yourself. It exports
`Latcher`, which every matcher plugs into.

## Create the matcher

```ts
import { createCognitoMatcher } from '@latcher/cognito'
import { logInvocation } from './middleware/logInvocation'

const cognitoMatcher = createCognitoMatcher({
  middleware: [logInvocation],  // Optional
})
```

`createCognitoMatcher()` on its own gives you a matcher with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `CognitoMiddleware[]` | No | `[]` | Runs for every event this matcher handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

The convenience method for a trigger family is the usual registration. It presets the `triggerSource`
filter and types the handler to that family, so `preSignUp` hands `allowSignUp` a `PreSignUpRequest`.

```ts
cognitoMatcher.preSignUp({
  filters: { userPoolId: 'eu-west-2_aBcDeFgHi' },  // Optional
  userAttributesSchema: UserAttributesSchema,  // Optional
  middleware: [withTenant],  // Optional
  handler: allowSignUp,
})
```

`handler` is the only required key.

`route()` is the general form beneath the family methods. It takes the same keys plus a `triggerSource`
filter, so reach for it to match across families or as a catch-all. Leave `filters` off and it matches
every Cognito event.

An inferred handler on `route()` is typed against the wide `CognitoRequest` union. Pin `triggerSource`
to one source and a handler annotated for that trigger assigns too.

```ts
cognitoMatcher.route({
  filters: { triggerSource: 'PreSignUp_SignUp' },
  handler: async ({ event }) => event,
})
```

Every registration method returns the matcher, so you can chain them.

```ts
cognitoMatcher.preSignUp({ handler: allowSignUp }).preTokenGeneration({ handler: addRoleClaim })
```

Routes are ranked by how specific they are. Where two overlap, the one matching only a subset of the
other is tried first, whatever order you registered them in. Registration order decides the rest, so give
each route filters no other route can match. A `triggerSource` does that on its own, since one event
carries exactly one source. See [match order](/docs/routing#match-order) for how ranking works and what
it cannot settle.

**An event that matches no route throws** `No route matched for trigger <source>`. The matcher claims
any event carrying a string `triggerSource` and `userPoolId`, so once Cognito routes a trigger to your
Lambda an unmatched one fails the invocation rather than falling through. Cognito needs the event
returned to it, so register a filter-less catch-all that returns the event untouched if you would
rather let unhandled triggers pass. See [nothing matched](/docs/routing#nothing-matched) for what the
other matchers do instead.

### Convenience methods

`preSignUp({ handler })` is `route()` with the three PreSignUp sources preset on the filter.

```ts
cognitoMatcher.preSignUp({ handler: allowSignUp })

// The same match with route(), though route() types the handler as the wide union
cognitoMatcher.route({
  filters: { triggerSource: ['PreSignUp_SignUp', 'PreSignUp_AdminCreateUser', 'PreSignUp_ExternalProvider'] },
  handler: async ({ event }) => event,
})
```

Setting `filters.triggerSource` yourself narrows the family further, so
`preSignUp({ filters: { triggerSource: 'PreSignUp_SignUp' } })` matches sign-up but not admin creation.

| Method | Default trigger sources |
| --- | --- |
| `preSignUp` | `PreSignUp_SignUp`, `PreSignUp_AdminCreateUser`, `PreSignUp_ExternalProvider` |
| `preAuthentication` | `PreAuthentication_Authentication` |
| `postAuthentication` | `PostAuthentication_Authentication` |
| `postConfirmation` | `PostConfirmation_ConfirmSignUp`, `PostConfirmation_ConfirmForgotPassword` |
| `defineAuthChallenge` | `DefineAuthChallenge_Authentication` |
| `createAuthChallenge` | `CreateAuthChallenge_Authentication` |
| `verifyAuthChallengeResponse` | `VerifyAuthChallengeResponse_Authentication` |
| `customMessage` | the seven `CustomMessage_*` sources |
| `customEmailSender` | the eight `CustomEmailSender_*` sources |
| `preTokenGeneration` | the five `TokenGeneration_*` sources |
| `userMigration` | `UserMigration_Authentication`, `UserMigration_ForgotPassword` |

Every individual trigger source also has its own method that pins the route to exactly that source,
named `<family><Source>`, so `preSignUpAdminCreateUser()` and `customMessageForgotPassword()`. Unlike
the family methods these take no `triggerSource` filter, since the name already fixes it. The
[trigger sources](#trigger-sources) section lists all of them. See
[convenience methods](/docs/routing#convenience-methods) for how the other matchers use them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the events you want and leave the rest off.

```ts
cognitoMatcher.route({
  filters: {
    triggerSource: ['PreSignUp_SignUp', 'PreSignUp_AdminCreateUser'],
    userPoolId: 'eu-west-2_aBcDeFgHi', // Or a pattern: /^eu-west-2_/
    clientId: ['web-client-id', 'mobile-client-id'],
    userAttributes: {
      email: '*@enroly.com', // A FilterStringMatcher, so wildcard, RegExp or exact string
      email_verified: 'true',
    },
    custom: ({ userName }) => {
      // Only a custom reaches userName and the raw event
      return !userName.startsWith('test-')
    },
  },
  handler: async ({ event }) => event,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `triggerSource` | `CognitoTriggerSource \| CognitoTriggerSource[]` | Exact match against the event's trigger source. Not a pattern, so list every source you want |
| `userPoolId` | `FilterStringMatcher` | Matches the pool the event came from |
| `clientId` | `FilterStringMatcher` | Matches `callerContext.clientId`, the app client that triggered the event |
| `userAttributes` | `Record<string, FilterStringMatcher>` | Every key listed must be present on the user and match. A missing attribute means no match |
| `custom` | `(input: CognitoFilterInput) => boolean \| Promise<boolean>` | Anything the other filters cannot express. Can be async |

`triggerSource` is the one key that is not a `FilterStringMatcher`. The rest are, where
`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**`clientId` is not always there, though the event type says it is a string.** `AdminConfirmSignUp`
sends no client id at all, and `AdminCreateUser` sends the literal `CLIENT_ID_NOT_APPLICABLE`.

A route filtering on `clientId` skips any event without one, `*` included. Use the filter to pick out
traffic from an app client, not to tell one admin call from another.

**`custom` sees the event before any schema has run**, and its `event` is typed `unknown`, so
narrow with `isObject` from `@latcher/base` before reading into it. UserMigration events
carry no user yet, so `input.request.userAttributes` is `undefined` for them. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument, change the event and return it.

```ts
import type { PreSignUpRequest } from '@latcher/cognito'
import type { PreSignUpTriggerEvent } from 'aws-lambda'

export async function allowSignUp({ event, userAttributes }: PreSignUpRequest): Promise<PreSignUpTriggerEvent> {
  if (userAttributes.email?.endsWith('@enroly.com')) {
    event.response.autoConfirmUser = true
    event.response.autoVerifyEmail = true
  }
  return event
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `triggerSource` | `CognitoTriggerSource` | The source that fired, narrowed to the route's family for a typed handler |
| `userAttributes` | `UserAttributes` | The user's attributes, validated if you set a schema. Empty for UserMigration since the user does not exist yet |
| `event` | the trigger event | The full Cognito event, cloned so changes never touch the original. Set fields on `event.response` and return it |
| `context` | `Context` | The Lambda context |

`UserAttributes` is exported from this package. The event type and `Context` come from `aws-lambda`.

### Response type

You return the event you were given, so `Promise<PreSignUpTriggerEvent>` for a typed handler or
`Promise<CognitoEvent>` for the wide one. The matcher hands it straight back to Cognito, which reads the
fields you set on `event.response`. See [Responses](#responses) for what each trigger reads.

### Inferred handlers

`defineRoute` reads the `triggerSource` and types both the request and the event you return, so a
`PreSignUp_SignUp` route gets a `PreSignUpRequest` and nothing to look up.

```ts
import { defineRoute } from '@latcher/cognito'

export const autoConfirmRoute = defineRoute({
  filters: { triggerSource: 'PreSignUp_SignUp' },
}).handle(async ({ event, userAttributes }) => {
  if (userAttributes.email?.endsWith('@enroly.com')) {
    event.response.autoConfirmUser = true
    event.response.autoVerifyEmail = true
  }
  return event
})

cognitoMatcher.preSignUp(autoConfirmRoute)
```

A `defineRoute` route carries its own pinned `triggerSource`, so register it through the family method
for that trigger. The convenience methods infer the same way for an inferred handler, so
`preSignUp({ handler })` is already typed to the family without `defineRoute` at all. See
[inferred handlers](/docs/handlers#inferred-handlers), where the same source is written both ways to
compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using the
[request type](#generic-parameters) for the family and returning its event.

```ts
// handlers/allowSignUp.ts
import type { PreSignUpRequest } from '@latcher/cognito'
import type { PreSignUpTriggerEvent } from 'aws-lambda'

export async function allowSignUp({ event, userAttributes }: PreSignUpRequest): Promise<PreSignUpTriggerEvent> {
  if (userAttributes.email?.endsWith('@enroly.com')) {
    event.response.autoConfirmUser = true
    event.response.autoVerifyEmail = true
  }
  return event
}
```

```ts
// cognito.ts
import { createCognitoMatcher } from '@latcher/cognito'
import { allowSignUp } from './handlers/allowSignUp'

const cognitoMatcher = createCognitoMatcher()

cognitoMatcher.preSignUp({ handler: allowSignUp })
```

A handler typed `PreSignUpRequest` fits the `preSignUp()` method. It also fits `route()`, as long as
`filters.triggerSource` names the trigger it is written for. Without that filter nothing tells `route()`
which trigger the handler expects, so annotate against `CognitoRequest` and narrow on `triggerSource`
inside. When you validate attributes, derive the type with `z.infer` and pass it as
`PreSignUpRequest<Attributes>` rather than hand-writing one. See
[annotated handlers](/docs/handlers#annotated-handlers) for the worked version.

## Schema validation

One key takes a schema, and it is optional.

```ts
import { z } from 'zod'

const UserAttributesSchema = z.object({
  email: z.string().email(),
  name: z.string(),
})

cognitoMatcher.postConfirmation({
  userAttributesSchema: UserAttributesSchema,
  handler: provisionUser,
})
```

| Key | Validates |
| --- | --- |
| `userAttributesSchema` | The user's attributes, before the handler runs |

Any [Standard Schema](https://standardschema.dev) library works. Validation runs after a route has
matched, so an event failing its schema throws rather than falling through to the next route. See
[schema validation](/docs/routing#schema-validation) for what your handler receives.

Cognito sends every attribute as a string, so `UserAttributes` is `Record<string, string>` and the
schema's output has to stay string-valued. Validate the shape and that an attribute is present, not a
coercion to a number or boolean.

**UserMigration events carry no user, so their attributes arrive as `{}`.** A schema requiring any
attribute throws on every migration event. Keep `userAttributesSchema` off `userMigration` routes, or
make each field optional.

## Responses

Your handler returns the event it was given, and the matcher hands that straight back to Cognito. Cognito
reads the fields you set on `event.response` to decide what happens next, so the response shape is
Cognito's contract rather than the matcher's.

What you set depends on the trigger.

| Trigger | Set on `event.response` | Effect |
| --- | --- | --- |
| PreSignUp | `autoConfirmUser`, `autoVerifyEmail`, `autoVerifyPhone` | Skip confirmation, or mark the email or phone verified |
| PreTokenGeneration | `claimsOverrideDetails` | Add, override or suppress token claims and group membership |
| CustomMessage | `smsMessage`, `emailMessage`, `emailSubject` | Replace the message Cognito sends |
| DefineAuthChallenge | `challengeName`, `issueTokens`, `failAuthentication` | Drive the next step of a custom auth flow |
| CreateAuthChallenge | `publicChallengeParameters`, `privateChallengeParameters`, `challengeMetadata` | Build the challenge to present |
| VerifyAuthChallengeResponse | `answerCorrect` | Accept or reject the user's answer |
| UserMigration | `userAttributes`, `finalUserStatus`, `messageAction`, `desiredDeliveryMediums` | Create the migrated user during sign-in |
| PreAuthentication, PostAuthentication, PostConfirmation, CustomEmailSender | nothing | No response fields, so do the work and return the event unchanged |

The exact fields per trigger are Cognito's, and the
[Cognito trigger reference](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html)
lists them all. Throwing from a handler fails the invocation, which for a sign-up or sign-in trigger
blocks the user from continuing.

## Middleware

Matcher and route middleware are both typed `CognitoMiddleware`, and the chain runs once per event.

```ts
import { logger } from '@latcher/base'
import type { CognitoMiddleware } from '@latcher/cognito'

export const logInvocation: CognitoMiddleware = async (request, next) => {
  logger.info(`Handling ${request.triggerSource} for pool ${request.event.userPoolId}`)
  return next(request)
}
```

```ts
const cognitoMatcher = createCognitoMatcher({ middleware: [logInvocation] })

cognitoMatcher.preSignUp({
  middleware: [withTenant],
  handler: allowSignUp,
})
```

**Route middleware carries the route's user attributes type.** A route with a
`userAttributesSchema` needs `CognitoMiddleware<Attributes>`. `CognitoMiddleware` on its own does not
compile there. Matcher middleware takes no type argument, because it runs for every route.

Matcher middleware runs before route middleware, and a schema failure throws before either runs. See
[middleware](/docs/middleware) for the execution order and the three levels it attaches at.

## Types

All exported from `@latcher/cognito`.

| Type | Description |
| --- | --- |
| `CognitoRequest<TUserAttributes>` | The wide handler argument, a union over every trigger |
| `CognitoEvent` | The event you return, a union of every trigger event |
| `CognitoFilters` | The `filters` object |
| `CognitoFilterInput` | What `custom` receives |
| `CognitoRouteDefinition<TUserAttributes>` | A full route passed to `route()` |
| `TypedRouteDefinition<TTrigger, TUserAttributes>` | A route pinned to one trigger, which `route()` also takes |
| `CognitoMatcherOptions` | Options for `createCognitoMatcher` |
| `CognitoMiddleware<TUserAttributes>` | Matcher and route middleware |
| `CognitoTriggerSource` | The union of every trigger source |
| `UserAttributes` | The user attribute record, `Record<string, string>` |
| `UserAttributeFilter` | A single attribute matcher, `string \| RegExp \| ((value: string) => boolean)` |

Each trigger family exports its own set on the same pattern: `<Family>Request<TUserAttributes>`,
`<Family>Response`, `<Family>Handler<TUserAttributes>`, `<Family>RouteDefinition<TUserAttributes>` and
`<Family>TriggerSource`, so `PreSignUpRequest`, `PreSignUpResponse` and the rest. Use these to annotate
a handler for one family. The `CognitoMatcher` class and the `createCognitoMatcher` and `defineRoute`
functions come from the same place.

### Generic parameters

| Parameter | Types | Default |
| --- | --- | --- |
| `TUserAttributes` | `request.userAttributes`, and the `userAttributesSchema` output | `UserAttributes` |

You only need it for [annotated handlers](#annotated-handlers) with a validated schema, as in
`PreSignUpRequest<Attributes>`.
Inference covers it otherwise.

## Trigger sources

Every trigger source the matcher knows, with the dedicated method that pins a route to just that source.
The family method above each group matches all of its sources at once.

| Family | Trigger source | Dedicated method |
| --- | --- | --- |
| PreSignUp | `PreSignUp_SignUp` | `preSignUpSignUp` |
| | `PreSignUp_AdminCreateUser` | `preSignUpAdminCreateUser` |
| | `PreSignUp_ExternalProvider` | `preSignUpExternalProvider` |
| PreAuthentication | `PreAuthentication_Authentication` | `preAuthenticationAuthentication` |
| PostAuthentication | `PostAuthentication_Authentication` | `postAuthenticationAuthentication` |
| PostConfirmation | `PostConfirmation_ConfirmSignUp` | `postConfirmationConfirmSignUp` |
| | `PostConfirmation_ConfirmForgotPassword` | `postConfirmationConfirmForgotPassword` |
| DefineAuthChallenge | `DefineAuthChallenge_Authentication` | `defineAuthChallengeAuthentication` |
| CreateAuthChallenge | `CreateAuthChallenge_Authentication` | `createAuthChallengeAuthentication` |
| VerifyAuthChallengeResponse | `VerifyAuthChallengeResponse_Authentication` | `verifyAuthChallengeResponseAuthentication` |
| CustomMessage | `CustomMessage_SignUp` | `customMessageSignUp` |
| | `CustomMessage_AdminCreateUser` | `customMessageAdminCreateUser` |
| | `CustomMessage_ResendCode` | `customMessageResendCode` |
| | `CustomMessage_ForgotPassword` | `customMessageForgotPassword` |
| | `CustomMessage_UpdateUserAttribute` | `customMessageUpdateUserAttribute` |
| | `CustomMessage_VerifyUserAttribute` | `customMessageVerifyUserAttribute` |
| | `CustomMessage_Authentication` | `customMessageAuthentication` |
| CustomEmailSender | `CustomEmailSender_SignUp` | `customEmailSenderSignUp` |
| | `CustomEmailSender_ResendCode` | `customEmailSenderResendCode` |
| | `CustomEmailSender_ForgotPassword` | `customEmailSenderForgotPassword` |
| | `CustomEmailSender_UpdateUserAttribute` | `customEmailSenderUpdateUserAttribute` |
| | `CustomEmailSender_VerifyUserAttribute` | `customEmailSenderVerifyUserAttribute` |
| | `CustomEmailSender_AdminCreateUser` | `customEmailSenderAdminCreateUser` |
| | `CustomEmailSender_Authentication` | `customEmailSenderAuthentication` |
| | `CustomEmailSender_AccountTakeOverNotification` | `customEmailSenderAccountTakeOverNotification` |
| PreTokenGeneration | `TokenGeneration_HostedAuth` | `preTokenGenerationHostedAuth` |
| | `TokenGeneration_Authentication` | `preTokenGenerationAuthentication` |
| | `TokenGeneration_NewPasswordChallenge` | `preTokenGenerationNewPasswordChallenge` |
| | `TokenGeneration_AuthenticateDevice` | `preTokenGenerationAuthenticateDevice` |
| | `TokenGeneration_RefreshTokens` | `preTokenGenerationRefreshTokens` |
| UserMigration | `UserMigration_Authentication` | `userMigrationAuthentication` |
| | `UserMigration_ForgotPassword` | `userMigrationForgotPassword` |

## Code example

One Lambda handling three points in the user lifecycle: auto-confirming trusted sign-ups, provisioning
the user record once confirmed, and adding a role claim to every token.

Open a file: [index.ts](#cognito-example:index.ts) | [Cognito matcher](#cognito-example:cognito.ts) | [handlers](#cognito-example:handlers/lifecycle.ts) | [schema](#cognito-example:schemas/userAttributes.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { Latcher } from '@latcher/base'

import { cognitoMatcher } from './cognito.js'

const latcher = new Latcher({
  matchers: [cognitoMatcher],
})

export const handler: Handler = latcher.handler()`,
  },
  {
    path: 'cognito.ts',
    code: `import { createCognitoMatcher } from '@latcher/cognito'

import { addRoleClaim, allowSignUp, provisionUser } from './handlers/lifecycle.js'
import { UserAttributesSchema } from './schemas/userAttributes.js'

export const cognitoMatcher = createCognitoMatcher()

cognitoMatcher
  .preSignUp({ handler: allowSignUp })
  .postConfirmation({
    userAttributesSchema: UserAttributesSchema,
    handler: provisionUser,
  })
  .preTokenGeneration({ handler: addRoleClaim })`,
  },
  {
    path: 'handlers/lifecycle.ts',
    code: `import { logger } from '@latcher/base'
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
}`,
  },
  {
    path: 'schemas/userAttributes.ts',
    code: `import { z } from 'zod'

export const UserAttributesSchema = z.object({
  email: z.string().email(),
  name: z.string(),
})

export type UserAttributes = z.infer<typeof UserAttributesSchema>`,
  },
]
</script>

<CodeFileViewer :files="files" id="cognito-example" default-file="cognito.ts" line-numbers collapse-toggle fixed-height />

Each route filters on a different trigger, so no event can match two and the order they register in
makes no difference. `provisionUser` reads a validated `userAttributes`, so its schema is attached on
the same route.

`index.ts` hands the matcher to `Latcher`, which is what AWS invokes and what every matcher in the
Lambda gets registered on. See [matchers](/docs/matchers) for how the two levels of matching fit together.

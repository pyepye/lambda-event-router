# SecretsManagerRouter

`SecretsManagerRouter` routes AWS Secrets Manager rotation events to handlers, one rotation step per
invocation.

Rotating a secret runs in four steps: `createSecret`, `setSecret`, `testSecret` and `finishSecret`.
Secrets Manager invokes your rotation Lambda once for each step, passing the secret it is rotating, the
step to carry out and a client request token that ties the four calls to one rotation. The router
matches on the step and the secret, then hands your handler the work for that step.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/secretsmanager
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createSecretsManagerRouter } from '@lambda-event-router/secretsmanager'
import { logStep } from './middleware/logStep'

const secretsManagerRouter = createSecretsManagerRouter({
  middleware: [logStep],  // Optional
})
```

`createSecretsManagerRouter()` on its own gives you a router with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `SecretsManagerMiddleware[]` | No | `[]` | Runs for every step this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
secretsManagerRouter.route({
  filters: {
    step: 'createSecret',
    secretId: 'prod/database/*',
  },
  middleware: [withSecretsClient],  // Optional
  handler: createDatabaseSecret,
})
```

`filters` and `handler` are the only required keys, and `filters` can be an empty object to match every
step.

`route()` returns the router, so you can chain registrations.

```ts
secretsManagerRouter.route(createRoute).route(setRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other route
can match. Matching on `step` does that, since a rotation delivers one step per call. See [match
order](/docs/routing#match-order) for what goes wrong when they overlap.

**A step that matches no route throws** `No route matched for Secrets Manager rotation event (step: ...,
secretId: ...)`. Secrets Manager expects every step to succeed, so an unmatched step fails the
invocation and the rotation is marked failed rather than falling through. Register a filter-less
catch-all last if you would rather handle every remaining step in one place, and see [nothing
matched](/docs/routing#nothing-matched) for what the other routers do instead.

A rotation event carries the step and the secret id rather than a payload you control, so there is
nothing to validate and no schema validation section on this page.

### Convenience methods

Each convenience method presets the `step` filter for one rotation step, so you register with the rest
of the filters and the method fills in the step.

```ts
secretsManagerRouter.createSecret({
  filters: { secretId: 'prod/database/*' },
  handler: createDatabaseSecret,
})

// The same route through route()
secretsManagerRouter.route({
  filters: { step: 'createSecret', secretId: 'prod/database/*' },
  handler: createDatabaseSecret,
})
```

| Method | Presets |
| --- | --- |
| `createSecret` | `step: 'createSecret'` |
| `setSecret` | `step: 'setSecret'` |
| `testSecret` | `step: 'testSecret'` |
| `finishSecret` | `step: 'finishSecret'` |

The method sets `step` itself and its filters type omits that key, so you pick the step through the
method and passing `step` in `filters` is a type error. See [convenience
methods](/docs/routing#convenience-methods) for how the other routers use them.

## Filters

Every filter key on one route, showing each form a value can take. All of them are optional, so set the
ones that pick out the steps you want and leave the rest off.

```ts
secretsManagerRouter.route({
  filters: {
    step: ['createSecret', 'setSecret', 'testSecret', 'finishSecret'],
    secretId: 'prod/database/*', // Or a pattern: /-AbCdEf$/
    custom: ({ clientRequestToken }) => clientRequestToken.startsWith('rotate-'),
  },
  handler: rotateSecret,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `step` | `SecretsManagerRotationEventStep \| SecretsManagerRotationEventStep[]` | Exact match against the rotation step: `createSecret`, `setSecret`, `testSecret` or `finishSecret`. Not a pattern, so list every step you want |
| `secretId` | `FilterStringMatcher` | Matches the ARN or name of the secret being rotated |
| `custom` | `(input: SecretsManagerFilterInput) => boolean \| Promise<boolean>` | Given the secret id, the step and the client request token. Anything the other filters cannot express. Can be async |

`step` is an exact-match union, not a pattern, so a value has to be one of the four steps. Only
`secretId` is a `FilterStringMatcher`, which is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

**`custom` is the only filter that reaches the client request token.** It receives the secret id,
the step and that token, so use it to match on the token that no built-in key covers. Unlike most
routers it is not handed the raw event, so there is nothing to narrow. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument, carry out the step and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { SecretsManagerRequest, SecretsManagerResponse } from '@lambda-event-router/secretsmanager'

export async function createDatabaseSecret(
  { secretId, clientRequestToken }: SecretsManagerRequest,
): Promise<SecretsManagerResponse> {
  logger.info(`Creating a new version of ${secretId} for token ${clientRequestToken}`)
  // Put the new secret value in the AWSPENDING stage
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `step` | `SecretsManagerRotationEventStep` | The rotation step to carry out |
| `secretId` | `string` | The ARN or name of the secret being rotated |
| `clientRequestToken` | `string` | The token tying the four steps of one rotation together, used as the new version id |
| `event` | `SecretsManagerRotationEvent` | The untouched event from AWS |
| `context` | `Context` | The Lambda context |

`SecretsManagerRotationEvent` and `Context` come from `aws-lambda`, not this package. `step`,
`secretId` and `clientRequestToken` are the `Step`, `SecretId` and `ClientRequestToken` off that event,
lower-cased.

### Response type

`SecretsManagerResponse` is `undefined`. Secrets Manager reads nothing back from the invocation, so your
handler does the work and returns nothing. See [Failures and retries](#failures-and-retries) for how a
step signals it went wrong.

### Inferred handlers

`defineRoute` types the handler from the router, so you get `step`, `secretId` and `clientRequestToken`
without naming `SecretsManagerRequest` anywhere.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/secretsmanager'

export const createDatabaseSecret = defineRoute({
  filters: { step: 'createSecret', secretId: 'prod/database/*' },
}).handle(async ({ secretId, clientRequestToken }) => {
  logger.info(`Creating a new version of ${secretId} for token ${clientRequestToken}`)
})

secretsManagerRouter.route(createDatabaseSecret)
```

Not having to name the request shape pays off most in a Lambda taking several event sources, since
every router hands its handler something different. See [inferred
handlers](/docs/handlers#inferred-handlers), where the same source is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`SecretsManagerRequest`](#types) as the argument type.

```ts
// handlers/createDatabaseSecret.ts
import { logger } from '@lambda-event-router/base'
import type { SecretsManagerRequest, SecretsManagerResponse } from '@lambda-event-router/secretsmanager'

export async function createDatabaseSecret(
  { secretId, clientRequestToken }: SecretsManagerRequest,
): Promise<SecretsManagerResponse> {
  logger.info(`Creating a new version of ${secretId} for token ${clientRequestToken}`)
}
```

```ts
// secretsManager.ts
import { createSecretsManagerRouter } from '@lambda-event-router/secretsmanager'
import { createDatabaseSecret } from './handlers/createDatabaseSecret'

const secretsManagerRouter = createSecretsManagerRouter()

secretsManagerRouter.createSecret({
  filters: { secretId: 'prod/database/*' },
  handler: createDatabaseSecret,
})
```

`SecretsManagerRequest` is the whole request type. There is no schema and no generic parameter, so
nothing to derive with `z.infer` and nothing to keep in sync. Every step hands the same request, so a
handler typed `SecretsManagerRequest` fits every registration form, `route()` and each convenience
method alike. See [annotated handlers](/docs/handlers#annotated-handlers) for the worked version.

## Failures and retries

The handler returns nothing, so a step reports failure by throwing. A thrown error fails the invocation,
and Secrets Manager marks the rotation attempt as failed. An unmatched step throws too, so it lands
there.

One step is one invocation, so there is no batch here and no partial reporting to configure. Secrets
Manager drives the four steps in order and retries a failed rotation on its own schedule, so a step has
to be safe to run again. A `createSecret` that already put a version in the `AWSPENDING` stage should
notice and skip rather than create a second.

## Middleware

Router and route middleware are both typed `SecretsManagerMiddleware`, and the chain runs once per step.

```ts
import { logger } from '@lambda-event-router/base'
import type { SecretsManagerMiddleware } from '@lambda-event-router/secretsmanager'

export const logStep: SecretsManagerMiddleware = async (request, next) => {
  logger.info(`Rotation step ${request.step} for ${request.secretId}`)
  return next(request)
}
```

```ts
const secretsManagerRouter = createSecretsManagerRouter({ middleware: [logStep] })

secretsManagerRouter.route({
  filters: { step: 'createSecret' },
  middleware: [withSecretsClient],
  handler: createDatabaseSecret,
})
```

Router middleware runs before route middleware. See [middleware](/docs/middleware) for the execution
order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/secretsmanager`.

| Type | Description |
| --- | --- |
| `SecretsManagerRequest` | The handler argument |
| `SecretsManagerResponse` | Handler return type, `undefined` |
| `SecretsManagerHandler` | The handler function, `(request: SecretsManagerRequest) => Promise<undefined>` |
| `SecretsManagerFilters` | The `filters` object |
| `SecretsManagerFilterInput` | What `custom` receives |
| `SecretsManagerMiddleware` | Router and route middleware |
| `SecretsManagerRouteDefinition` | A full route passed to `route()` |
| `SecretsManagerStepRouteDefinition` | A route passed to a step method |
| `SecretsManagerStepFilters` | The `filters` for a step method |
| `SecretsManagerRouterOptions` | Options for `createSecretsManagerRouter` |

The `SecretsManagerRouter` class and the `createSecretsManagerRouter` and `defineRoute` functions come
from the same place.

No Secrets Manager type takes a generic parameter. The request has one fixed shape, so there is no
`### Generic parameters` table that a reader arriving from another router might expect.

## Code example

One rotation Lambda covering all four steps for a database secret, with each step on its own route.

Open a file: [index.ts](#secretsmanager-example:index.ts) | [Secrets Manager router](#secretsmanager-example:secretsManager.ts) | [handlers](#secretsmanager-example:handlers/rotation.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { secretsManagerRouter } from './secretsManager.js'

const lambdaRouter = new LambdaRouter({
  routers: [secretsManagerRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'secretsManager.ts',
    code: `import { createSecretsManagerRouter } from '@lambda-event-router/secretsmanager'

import { createSecret, finishSecret, setSecret, testSecret } from './handlers/rotation.js'

export const secretsManagerRouter = createSecretsManagerRouter()

secretsManagerRouter
  .createSecret({ filters: { secretId: 'prod/database/*' }, handler: createSecret })
  .setSecret({ filters: { secretId: 'prod/database/*' }, handler: setSecret })
  .testSecret({ filters: { secretId: 'prod/database/*' }, handler: testSecret })
  .finishSecret({ filters: { secretId: 'prod/database/*' }, handler: finishSecret })`,
  },
  {
    path: 'handlers/rotation.ts',
    code: `import { logger } from '@lambda-event-router/base'
import type { SecretsManagerRequest, SecretsManagerResponse } from '@lambda-event-router/secretsmanager'

export async function createSecret(
  { secretId, clientRequestToken }: SecretsManagerRequest,
): Promise<SecretsManagerResponse> {
  logger.info(\`Creating a new version of \${secretId} for token \${clientRequestToken}\`)
  // Put a new secret value in the AWSPENDING stage
}

export async function setSecret({ secretId }: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  logger.info(\`Setting the pending value of \${secretId} on the database\`)
}

export async function testSecret({ secretId }: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  logger.info(\`Testing the pending value of \${secretId}\`)
}

export async function finishSecret({ secretId }: SecretsManagerRequest): Promise<SecretsManagerResponse> {
  logger.info(\`Promoting the pending value of \${secretId} to AWSCURRENT\`)
}`,
  },
]
</script>

<CodeFileViewer :files="files" id="secretsmanager-example" default-file="secretsManager.ts" line-numbers collapse-toggle fixed-height />

Each route matches a different step, so no invocation can match two and the order they register in makes
no difference. The four steps run in sequence across four invocations, and each hands its handler the
same `secretId` and `clientRequestToken` so it can act on the version the previous step created.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit together.

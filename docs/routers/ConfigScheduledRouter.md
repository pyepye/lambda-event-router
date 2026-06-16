# ConfigScheduledRouter

`ConfigScheduledRouter` routes an AWS Config scheduled evaluation to a handler.

A Config rule with a periodic trigger runs on a fixed frequency rather than on a resource change, and
invokes your Lambda with a `ScheduledNotification`. The router works out which of your routes should
run by the rule name or the account id, and hands the handler the rule parameters and the result token
it needs to report the outcome.

Resource change evaluations are a different notification type and go to
[`ConfigRouter`](/routers/ConfigRouter) instead. A scheduled evaluation carries no changed resource,
so you query the resources yourself and report on each one.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/config
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createConfigScheduledRouter } from '@lambda-event-router/config'
import { logInvocation } from './middleware/logInvocation'

const scheduledRouter = createConfigScheduledRouter({
  middleware: [logInvocation],  // Optional
})
```

`middleware` is the only option and it can be left out. `createConfigScheduledRouter()` on its own
gives you a router with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `ConfigScheduledMiddleware[]` | No | `[]` | Runs for every evaluation this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
scheduledRouter.route({
  filters: { configRuleName: 'periodic-tag-audit' },
  ruleParametersSchema,               // Optional
  middleware: [withRequestContext],   // Optional
  handler: runTagAudit,
})
```

`filters` and `handler` are the only required keys, and `filters` can be an empty object to match
every scheduled evaluation.

`route()` returns the router, so you can chain registrations.

```ts
scheduledRouter.route(tagAuditRoute).route(crossAccountRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other
route can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**An evaluation that matches no route throws** `No route matched for scheduled config rule <name>`,
which fails the invocation. Register a route with empty `filters` as a catch-all if you would rather
swallow rules you do not recognise, and see [nothing matched](/docs/routing#nothing-matched) for what
the other routers do instead.

## Filters

Every filter key across two routes. Both keys are optional, so set the ones that pick out the
evaluations you want and leave the rest off.

```ts
scheduledRouter.route({
  filters: {
    configRuleName: 'periodic-tag-audit',
    accountId: ['123456789012', '987654321098'], // Or a pattern: /^1234/
  },
  handler: runTagAudit,
})
```

`custom` reads the same two fields the dedicated keys match on, so pinning a key and testing it
again inside `custom` is redundant. Show it on its own, for logic across those fields that the
separate keys cannot express.

```ts
scheduledRouter.route({
  filters: {
    custom: ({ configRuleName, accountId }) =>
      configRuleName.startsWith('prod-') && accountId !== '123456789012',
  },
  handler: runTagAudit,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `configRuleName` | `FilterStringMatcher` | Matches the Config rule that invoked the Lambda |
| `accountId` | `FilterStringMatcher` | Matches the AWS account the evaluation runs in |
| `custom` | `(input: ConfigScheduledFilterInput) => boolean \| Promise<boolean>` | The two fields above and nothing else. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard. Both
`configRuleName` and `accountId` honour every form, so `configRuleName: 'prod-*'` or a `RegExp`
matches by pattern the same way `accountId` does.

**A `custom` is handed only `ConfigScheduledFilterInput`, the rule name and the account id, not
the rule parameters or the raw event.** It cannot read anything the dedicated keys do not already
cover, so reserve it for combining the two, an OR across them or a relationship between them. See
[`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { ConfigScheduledRequest } from '@lambda-event-router/config'

export async function runTagAudit(request: ConfigScheduledRequest): Promise<void> {
  logger.info(`Running ${request.configRuleName} for account ${request.accountId}`)
}
```

### Request object

| Field | Type | Description |
| --- | --- | --- |
| `resultToken` | `string` | The token you pass to `PutEvaluations` to report the result |
| `configRuleName` | `string` | The Config rule that invoked the Lambda |
| `accountId` | `string` | The AWS account the evaluation runs in |
| `ruleParameters` | `TParams` | The rule's parameters, parsed from JSON. Defaults to `{}` |
| `event` | `ConfigEvent` | The untouched event from AWS |
| `context` | `Context` | The Lambda context |

`Context` comes from `aws-lambda`. `ConfigEvent` comes from this package.

### Response type

Handlers return `Promise<void>`. `ConfigResponse` is `undefined`, so the router hands nothing back to
Lambda. Reporting compliance to Config is a call you make yourself, see
[Reporting evaluations](#reporting-evaluations). Throwing is how you signal failure, see
[Failures and retries](#failures-and-retries).

### Inferred handlers

`defineConfigScheduledRoute` hands your handler a fully typed request built from the schema, so you
never name the request type. It is a two step call: define the route, then attach the handler with
`.handle()`.

```ts
import { logger } from '@lambda-event-router/base'
import { defineConfigScheduledRoute } from '@lambda-event-router/config'

export const tagAuditRoute = defineConfigScheduledRoute({
  filters: { configRuleName: 'periodic-tag-audit' },
  ruleParametersSchema,
}).handle(async ({ accountId, ruleParameters, resultToken }) => {
  const requiredTags = JSON.parse(ruleParameters.requiredTags) as string[]
  logger.info(`Auditing ${requiredTags.join(', ')} in ${accountId} (token ${resultToken})`)
})

scheduledRouter.route(tagAuditRoute)
```

Not knowing the request shape pays off most in a Lambda taking several event sources, since you never
have to look any of them up. See [inferred handlers](/docs/handlers#inferred-handlers), where the same
source is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`ConfigScheduledRequest<TParams>`](#generic-parameters) and your own type for the parameters. Derive
that type from your schema with `z.infer` rather than hand-writing it.

```ts
// handlers/runTagAudit.ts
import { logger } from '@lambda-event-router/base'
import type { ConfigScheduledRequest } from '@lambda-event-router/config'
import type { z } from 'zod'
import type { tagAuditParamsSchema } from '../schemas/rules'

type TagAuditParams = z.infer<typeof tagAuditParamsSchema>

export async function runTagAudit(
  request: ConfigScheduledRequest<TagAuditParams>,
): Promise<void> {
  const requiredTags = JSON.parse(request.ruleParameters.requiredTags) as string[]
  logger.info(`Auditing ${requiredTags.join(', ')} in ${request.accountId}`)
}
```

```ts
// scheduled.ts
import { createConfigScheduledRouter } from '@lambda-event-router/config'
import { runTagAudit } from './handlers/runTagAudit'
import { tagAuditParamsSchema } from './schemas/rules'

const scheduledRouter = createConfigScheduledRouter()

scheduledRouter.route({
  filters: { configRuleName: 'periodic-tag-audit' },
  ruleParametersSchema: tagAuditParamsSchema,
  handler: runTagAudit,
})
```

See [annotated handlers](/docs/handlers#annotated-handlers) for the worked version.

## Schema validation

One key takes a schema and it is optional. Any [Standard Schema](/docs/routing#schema-validation)
library works, so Zod, Valibot and ArkType are interchangeable.

```ts
import { z } from 'zod'
import { defineConfigScheduledRoute } from '@lambda-event-router/config'

const ruleParametersSchema = z.object({
  requiredTags: z.string(), // JSON-encoded array of tag keys
})

export const tagAuditRoute = defineConfigScheduledRoute({
  filters: { configRuleName: 'periodic-tag-audit' },
  ruleParametersSchema,
}).handle(async ({ ruleParameters }) => {
  // ruleParameters is typed from ruleParametersSchema
})
```

| Key | Validates | Handler receives |
| --- | --- | --- |
| `ruleParametersSchema` | The rule's parameters, parsed from `event.ruleParameters` | `ruleParameters` typed as the schema output |

Config passes every rule parameter as a string, so a schema of `z.string()` fields that you parse
yourself matches what actually arrives. A failing schema throws before the handler runs. See
[validation failures](/docs/routing#validation-failures) for what your handler gets after coercion.

## Failures and retries

An evaluation that matches no route throws `No route matched for scheduled config rule <name>`, and a
handler that throws propagates the error out of the Lambda. One event carries one scheduled
evaluation, so there is no batch and nothing partial to report.

AWS Config invokes your function directly and does not read a return value, so a throw surfaces to
Config as a failed evaluation rather than being redelivered the way an asynchronous source would.

## Reporting evaluations

Config does not read your handler's return value. You report whether each resource is compliant by
calling the Config `PutEvaluations` API yourself, passing the `resultToken` from the request. Every
request carries `resultToken` for this.

A scheduled evaluation carries no changed resource, so list the resources you want to check through
the relevant AWS APIs, evaluate each one, then report them in one or more `PutEvaluations` calls.

```ts
import { ConfigServiceClient, PutEvaluationsCommand } from '@aws-sdk/client-config-service'
import { defineConfigScheduledRoute } from '@lambda-event-router/config'

const config = new ConfigServiceClient({})

scheduledRouter.route(
  defineConfigScheduledRoute({ filters: { configRuleName: 'periodic-tag-audit' } }).handle(
    async ({ accountId, resultToken }) => {
      // Discover and evaluate resources for this account, then report each one
      await config.send(
        new PutEvaluationsCommand({
          ResultToken: resultToken,
          Evaluations: [
            {
              ComplianceResourceType: 'AWS::S3::Bucket',
              ComplianceResourceId: `${accountId}-logs`,
              ComplianceType: 'COMPLIANT',
              OrderingTimestamp: new Date(),
            },
          ],
        }),
      )
    },
  ),
)
```

## Middleware

Router and route middleware are both typed `ConfigScheduledMiddleware`, and the chain runs once per
evaluation.

```ts
import { logger } from '@lambda-event-router/base'
import type { ConfigScheduledMiddleware } from '@lambda-event-router/config'

export const logInvocation: ConfigScheduledMiddleware = async (request, next) => {
  logger.info(`Handling ${request.configRuleName} for account ${request.accountId}`)
  return next(request)
}
```

```ts
const scheduledRouter = createConfigScheduledRouter({ middleware: [logInvocation] })

scheduledRouter.route({
  filters: { configRuleName: 'periodic-tag-audit' },
  middleware: [withRequestContext],
  handler: runTagAudit,
})
```

**Route middleware carries the route's parameters type.** A route with a `ruleParametersSchema` needs
`ConfigScheduledMiddleware<TagAuditParams>`. `ConfigScheduledMiddleware` on its own does not compile
there. Router middleware takes no type argument, because it runs for every route.

Router middleware runs before route middleware, and both run before the handler. A middleware that
does not call `next` short-circuits the chain, so the handler never runs. A schema validation failure
throws before the chain starts, so middleware never sees it.

See [middleware](/docs/middleware) for the execution order and the three levels it attaches at.

## Types

All exported from `@lambda-event-router/config`.

| Type | Description |
| --- | --- |
| `ConfigScheduledRequest` | The handler argument |
| `ConfigScheduledFilters` | The `filters` object |
| `ConfigScheduledFilterInput` | What a `custom` receives |
| `ConfigScheduledMiddleware<TParams>` | Router and route middleware |
| `ConfigScheduledRouteDefinition` | A full route passed to `route()` |
| `ConfigScheduledRouterOptions` | Options for `createConfigScheduledRouter` |
| `ConfigEvent` | The untouched event from AWS |
| `ConfigResponse` | The handler return type, `undefined` |

The `ConfigScheduledRouter` class and the `createConfigScheduledRouter` and
`defineConfigScheduledRoute` functions come from the same place.

### Generic parameters

| Parameter | Types | Default |
| --- | --- | --- |
| `TParams` | `ruleParameters`, from `ruleParametersSchema` | `Record<string, string>` |

`ConfigScheduledRequest<TParams>` and `ConfigScheduledMiddleware<TParams>` take the one parameter, so
leave it off to get the default when a route has no `ruleParametersSchema`.

## Code example

One Lambda running two scheduled Config rules, each keyed to a distinct rule name, with a Zod schema
on the parameters of one and the result reported through `PutEvaluations`.

Open a file: [index.ts](#scheduled-example:index.ts) | [Scheduled router](#scheduled-example:scheduled.ts) | [schemas](#scheduled-example:schemas/rules.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { scheduledRouter } from './scheduled.js'

const lambdaRouter = new LambdaRouter({
  routers: [scheduledRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'scheduled.ts',
    code: `import { ConfigServiceClient, PutEvaluationsCommand } from '@aws-sdk/client-config-service'
import { logger } from '@lambda-event-router/base'
import { createConfigScheduledRouter, defineConfigScheduledRoute } from '@lambda-event-router/config'

import { tagAuditParamsSchema } from './schemas/rules.js'

const config = new ConfigServiceClient({})

export const scheduledRouter = createConfigScheduledRouter()

scheduledRouter
  .route(
    defineConfigScheduledRoute({
      filters: { configRuleName: 'periodic-tag-audit' },
      ruleParametersSchema: tagAuditParamsSchema,
    }).handle(async ({ accountId, ruleParameters, resultToken }) => {
      const requiredTags = JSON.parse(ruleParameters.requiredTags) as string[]
      logger.info(\`Auditing tags \${requiredTags.join(', ')} in account \${accountId}\`)
      await report(accountId, true, resultToken)
    }),
  )
  .route(
    defineConfigScheduledRoute({
      filters: {
        configRuleName: 'cross-account-access-check',
        accountId: ['123456789012', '987654321098'],
      },
    }).handle(async ({ accountId, resultToken }) => {
      logger.info(\`Checking cross-account access in \${accountId}\`)
      await report(accountId, true, resultToken)
    }),
  )

async function report(accountId: string, compliant: boolean, resultToken: string): Promise<void> {
  await config.send(
    new PutEvaluationsCommand({
      ResultToken: resultToken,
      Evaluations: [
        {
          ComplianceResourceType: 'AWS::::Account',
          ComplianceResourceId: accountId,
          ComplianceType: compliant ? 'COMPLIANT' : 'NON_COMPLIANT',
          OrderingTimestamp: new Date(),
        },
      ],
    }),
  )
}`,
  },
  {
    path: 'schemas/rules.ts',
    code: `import { z } from 'zod'

export const tagAuditParamsSchema = z.object({
  requiredTags: z.string(), // JSON-encoded array of tag keys
})`,
  },
]
</script>

<CodeFileViewer :files="files" id="scheduled-example" default-file="scheduled.ts" line-numbers collapse-toggle fixed-height />

The two routes match on distinct rule names, so no evaluation matches both and the order you register
them in makes no difference. Each handler reports its result with the `resultToken`.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

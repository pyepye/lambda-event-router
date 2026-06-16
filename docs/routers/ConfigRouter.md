# ConfigRouter

`ConfigRouter` routes an AWS Config configuration change to a handler.

AWS Config invokes your Lambda when a resource covered by a custom Config rule changes. The router
works out which of your routes should evaluate the change by the rule name, the resource type, the
resource id or the item status, and hands the handler the changed resource.

A change arrives as one of two notifications. Config sends a `ConfigurationItemChangeNotification`
with the full item, or an `OversizedConfigurationItemChangeNotification` carrying only a summary when
the item is too large for the delivery. The router handles both. Scheduled evaluations are a third
notification type and go to [`ConfigScheduledRouter`](/routers/ConfigScheduledRouter) instead.

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/config
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports
`LambdaRouter`, which every router plugs into.

## Create the router

```ts
import { createConfigRouter } from '@lambda-event-router/config'
import { logInvocation } from './middleware/logInvocation'

const configRouter = createConfigRouter({
  middleware: [logInvocation],  // Optional
})
```

`middleware` is the only option and it can be left out. `createConfigRouter()` on its own gives you a
router with no shared middleware.

### Options

| Option | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `middleware` | `ConfigMiddleware[]` | No | `[]` | Runs for every change this router handles, before any route middleware. See [Middleware](#middleware) |

## Register routes

```ts
configRouter.route({
  filters: { configRuleName: 'required-tags' },
  ruleParametersSchema,               // Optional
  configurationSchema,                // Optional
  middleware: [withRequestContext],   // Optional
  handler: evaluateTags,
})
```

`filters` and `handler` are the only required keys, and `filters` can be an empty object to match
every change.

`route()` returns the router, so you can chain registrations.

```ts
configRouter.route(tagsRoute).route(encryptionRoute)
```

Routes match in registration order and the first match wins, so give each route filters no other
route can match. See [match order](/docs/routing#match-order) for what goes wrong when they overlap.

**A change that matches no route throws** `No route matched for config rule <name>`, which fails the
invocation. Register a route with empty `filters` as a catch-all if you would rather swallow rules
you do not recognise, and see [nothing matched](/docs/routing#nothing-matched) for what the other
routers do instead.

## Filters

Every filter key across two routes. All of them are optional, so set the ones that pick out the
changes you want and leave the rest off.

```ts
configRouter.route({
  filters: {
    configRuleName: 'required-tags',
    resourceType: 'AWS::EC2::Instance', // Or a pattern: /^AWS::EC2::/
    resourceId: ['i-abc123', 'i-xyz789'],
    configurationItemStatus: ['OK', 'ResourceDiscovered'],
  },
  handler: evaluateTags,
})
```

`custom` reads the same four fields the dedicated keys match on, so pinning a key and testing
it again inside `custom` is redundant. Show it on its own, for logic across those fields that
separate keys cannot express.

```ts
configRouter.route({
  filters: {
    custom: ({ resourceType, resourceId }) =>
      resourceType === 'AWS::S3::Bucket' || resourceId.startsWith('prod-'),
  },
  handler: evaluateResource,
})
```

| Filter | Type | Description |
| --- | --- | --- |
| `configRuleName` | `FilterStringMatcher` | Matches the Config rule that invoked the Lambda |
| `resourceType` | `FilterStringMatcher` | Matches the changed resource's type, such as `AWS::EC2::Instance` |
| `resourceId` | `FilterStringMatcher` | Matches the changed resource's id |
| `configurationItemStatus` | `FilterStringMatcher` | Matches the item status, such as `OK`, `ResourceDiscovered` or `ResourceDeleted` |
| `custom` | `(input: ConfigChangeFilterInput) => boolean \| Promise<boolean>` | The four fields above and nothing else. Can be async |

`FilterStringMatcher` is `string | RegExp | Array<string | RegExp>`. See
[filters](/docs/routing#filters) for how each form matches, including the `*` wildcard.

`resourceType`, `resourceId` and `configurationItemStatus` come from the full item on a normal change
and from the summary on an oversized one, so all four keys match both notification shapes.

**A `custom` is handed only `ConfigChangeFilterInput`, the same four match fields, not the
resource configuration or the raw event.** It cannot read anything the dedicated keys do not already
cover, so reserve it for combining those fields, an OR across two of them or a relationship between
them. See [`custom`](/docs/routing#custom) for where it sits in the filter order.

## Handler

Handlers take one argument and return nothing.

```ts
import { logger } from '@lambda-event-router/base'
import type { ConfigRequest } from '@lambda-event-router/config'

export async function evaluateTags(request: ConfigRequest): Promise<void> {
  logger.info(`Evaluating ${request.configurationItem.resourceId} for rule ${request.configRuleName}`)
}
```

### Request object

The request is one of two shapes. A normal change gives you a `ConfigRequest` with the full item; an
oversized change gives you a `ConfigOversizedRequest` with a summary and no configuration. Narrow on
`configurationItem` to tell them apart.

| Field | Type | Description |
| --- | --- | --- |
| `configurationItem` | `ConfigurationItem<TConfig>` on a normal change, `undefined` on an oversized one | The changed resource, including its `configuration` |
| `configurationItemSummary` | `ConfigurationItemSummary` on an oversized change, `undefined` on a normal one | Metadata only, with no `configuration`. Fetch the full item yourself when you need it |
| `ruleParameters` | `TParams` | The rule's parameters, parsed from JSON. Defaults to `{}` |
| `resultToken` | `string` | The token you pass to `PutEvaluations` to report the result |
| `configRuleName` | `string` | The Config rule that invoked the Lambda |
| `event` | `ConfigEvent` | The untouched event from AWS |
| `context` | `Context` | The Lambda context |

`Context` comes from `aws-lambda`. `ConfigEvent`, `ConfigurationItem` and `ConfigurationItemSummary`
come from this package.

A route's filters do not pin the notification type, so a route can match both a normal and an
oversized change. An inferred handler is handed the union of both shapes and narrows on
`configurationItem`.

```ts
if (request.configurationItem) {
  // Normal change: the full configuration is here
} else {
  // Oversized: only request.configurationItemSummary, fetch the rest yourself
}
```

### Response type

Handlers return `Promise<void>`. `ConfigResponse` is `undefined`, so the router hands nothing back to
Lambda. Reporting the outcome to Config is a call you make yourself, see
[Reporting evaluations](#reporting-evaluations). Throwing is how you signal failure, see
[Failures and retries](#failures-and-retries).

### Inferred handlers

`defineRoute` hands your handler a fully typed request built from the schemas, so you never name the
request type. Because a route can match a normal or an oversized change, the handler receives the
union and narrows on `configurationItem`.

```ts
import { logger } from '@lambda-event-router/base'
import { defineRoute } from '@lambda-event-router/config'

export const encryptionRoute = defineRoute({
  filters: { configRuleName: 'rds-encryption', resourceType: 'AWS::RDS::DBInstance' },
  configurationSchema,
}).handle(async ({ configurationItem, configurationItemSummary, resultToken }) => {
  if (!configurationItem) {
    logger.info(`Oversized change for ${configurationItemSummary.resourceId}, fetching full item`)
    return
  }
  logger.info(`Encrypted: ${configurationItem.configuration.storageEncrypted} (token ${resultToken})`)
})

configRouter.route(encryptionRoute)
```

Not knowing the request shape pays off most in a Lambda taking several event sources, since you never
have to look any of them up. See [inferred handlers](/docs/handlers#inferred-handlers), where the same
source is written both ways to compare.

### Annotated handlers

Annotating the request yourself splits route setup from business logic, using
[`ConfigRequest<TConfig, TParams>`](#generic-parameters) for a normal change or
[`ConfigOversizedRequest<TParams>`](#generic-parameters) for an oversized one. Derive the parameter
types from your schemas with `z.infer` rather than hand-writing them.

```ts
// handlers/evaluateEncryption.ts
import { logger } from '@lambda-event-router/base'
import type { ConfigRequest } from '@lambda-event-router/config'
import type { z } from 'zod'
import type { configurationSchema } from '../schemas/rules'

type RdsConfig = z.infer<typeof configurationSchema>

export async function evaluateEncryption(
  request: ConfigRequest<RdsConfig>,
): Promise<void> {
  logger.info(`Encrypted: ${request.configurationItem.configuration.storageEncrypted}`)
}
```

```ts
// config.ts
import { createConfigRouter } from '@lambda-event-router/config'
import { evaluateEncryption } from './handlers/evaluateEncryption'
import { configurationSchema } from './schemas/rules'

const configRouter = createConfigRouter()

configRouter.route({
  filters: { configRuleName: 'rds-encryption', resourceType: 'AWS::RDS::DBInstance' },
  configurationSchema,
  handler: evaluateEncryption,
})
```

**`route()` accepts a handler typed to only one shape, but the filters do not pin the notification
type.** A handler typed `ConfigRequest` still runs for an oversized change if its filters match one,
and `configurationItem` arrives `undefined`, so reading it throws. Type the handler
`ConfigRequest | ConfigOversizedRequest` and guard on `configurationItem`, or use an inferred handler,
which is handed the union and forces the check. See
[annotated handlers](/docs/handlers#annotated-handlers) for the worked version.

## Schema validation

Two keys take a schema and both are optional. Any [Standard Schema](/docs/routing#schema-validation)
library works, so Zod, Valibot and ArkType are interchangeable.

```ts
import { z } from 'zod'
import { defineRoute } from '@lambda-event-router/config'

const ruleParametersSchema = z.object({
  maxKeyAge: z.string(),
})

const configurationSchema = z.object({
  storageEncrypted: z.boolean(),
  engineVersion: z.string(),
})

export const encryptionRoute = defineRoute({
  filters: { configRuleName: 'rds-encryption' },
  ruleParametersSchema,
  configurationSchema,
}).handle(async ({ configurationItem, ruleParameters }) => {
  // ruleParameters is typed from ruleParametersSchema, configuration from configurationSchema
})
```

| Key | Validates | Handler receives |
| --- | --- | --- |
| `ruleParametersSchema` | The rule's parameters, parsed from `event.ruleParameters` | `ruleParameters` typed as the schema output |
| `configurationSchema` | `configurationItem.configuration` on a normal change | `configurationItem.configuration` typed as the schema output |

`ruleParametersSchema` runs for both notification shapes. **`configurationSchema` runs only for a
normal change**, because an oversized notification carries no configuration, so a route that matches
an oversized change ignores it. A failing schema throws before the handler runs, and middleware does
not run either. See [validation failures](/docs/routing#validation-failures) for what your handler
gets after coercion.

## Failures and retries

A change that matches no route throws `No route matched for config rule <name>`, and a handler that
throws propagates the error out of the Lambda. One event carries one change, so there is no batch and
nothing partial to report.

AWS Config invokes your function directly and does not read a return value, so a throw surfaces to
Config as a failed evaluation rather than being redelivered the way an asynchronous source would.

## Reporting evaluations

Config does not read your handler's return value. You report whether the resource is compliant by
calling the Config `PutEvaluations` API yourself, passing the `resultToken` from the request. Every
request carries `resultToken` for this.

```ts
import { ConfigServiceClient, PutEvaluationsCommand } from '@aws-sdk/client-config-service'

const config = new ConfigServiceClient({})

configRouter.route(
  defineRoute({ filters: { configRuleName: 'rds-encryption' } }).handle(
    async ({ configurationItem, resultToken }) => {
      if (!configurationItem) return
      const compliant = configurationItem.configuration.storageEncrypted === true

      await config.send(
        new PutEvaluationsCommand({
          ResultToken: resultToken,
          Evaluations: [
            {
              ComplianceResourceType: configurationItem.resourceType,
              ComplianceResourceId: configurationItem.resourceId,
              ComplianceType: compliant ? 'COMPLIANT' : 'NON_COMPLIANT',
              OrderingTimestamp: new Date(configurationItem.configurationItemCaptureTime),
            },
          ],
        }),
      )
    },
  ),
)
```

On an oversized change you get a summary rather than the configuration, so fetch the full item, for
example with `GetResourceConfigHistory`, before you can evaluate and report it.

## Middleware

Router and route middleware are both typed `ConfigMiddleware`, and the chain runs once per change.

```ts
import { logger } from '@lambda-event-router/base'
import type { ConfigMiddleware } from '@lambda-event-router/config'

export const logInvocation: ConfigMiddleware = async (request, next) => {
  logger.info(`Handling change for rule ${request.configRuleName}`)
  return next(request)
}
```

```ts
const configRouter = createConfigRouter({ middleware: [logInvocation] })

configRouter.route({
  filters: { configRuleName: 'required-tags' },
  middleware: [withRequestContext],
  handler: evaluateTags,
})
```

**Route middleware carries the route's schema types.** A route with a `configurationSchema` or a
`ruleParametersSchema` needs `ConfigMiddleware<Configuration, Params>`. `ConfigMiddleware` on its own
does not compile there. Router middleware takes no type argument, because it runs for every route.

A middleware still gets the request as the union of both notification shapes. It runs before the
handler picks one. See [middleware](/docs/middleware) for the execution order and the three levels
it attaches at.

## Types

All exported from `@lambda-event-router/config`.

| Type | Description |
| --- | --- |
| `ConfigRequest` | The handler argument on a normal change |
| `ConfigOversizedRequest` | The handler argument on an oversized change |
| `ConfigChangeFilters` | The `filters` object |
| `ConfigChangeFilterInput` | What a `custom` receives |
| `ConfigMessageType` | The notification message types |
| `ConfigMiddleware<TConfig, TParams>` | Router and route middleware |
| `ConfigChangeHandler` | The `handler` function |
| `ConfigRouteDefinition` | A full route passed to `route()` |
| `ConfigRouterOptions` | Options for `createConfigRouter` |
| `ConfigurationItem` | The changed resource on a normal change |
| `ConfigurationItemSummary` | The metadata on an oversized change |
| `ConfigEvent` | The untouched event from AWS |
| `ConfigResponse` | The handler return type, `undefined` |

The `ConfigRouter` class and the `createConfigRouter` and `defineRoute` functions come from the same
place.

### Generic parameters

| Parameter | Types | Default |
| --- | --- | --- |
| `TConfig` | `configurationItem.configuration`, from `configurationSchema` | `Record<string, unknown>` |
| `TParams` | `ruleParameters`, from `ruleParametersSchema` | `Record<string, string>` |

`ConfigRequest<TConfig, TParams>` and `ConfigMiddleware<TConfig, TParams>` take both, and
`ConfigurationItem<TConfig>` takes the first, so you can pass only `TConfig` and leave `TParams` on
its default. `ConfigOversizedRequest<TParams>` takes only `TParams`, since an oversized notification
has no configuration to type.

## Code example

One Lambda evaluating two Config rules, each keyed to a distinct rule name, with a Zod schema on the
configuration and the result reported through `PutEvaluations`.

Open a file: [index.ts](#config-example:index.ts) | [Config router](#config-example:config.ts) | [schemas](#config-example:schemas/rules.ts)

<script setup>
const files = [
  {
    path: 'index.ts',
    code: `import type { Handler } from 'aws-lambda'
import { LambdaRouter } from '@lambda-event-router/base'

import { configRouter } from './config.js'

const lambdaRouter = new LambdaRouter({
  routers: [configRouter],
})

export const handler: Handler = lambdaRouter.handler()`,
  },
  {
    path: 'config.ts',
    code: `import { ConfigServiceClient, PutEvaluationsCommand } from '@aws-sdk/client-config-service'
import { logger } from '@lambda-event-router/base'
import { createConfigRouter, defineRoute } from '@lambda-event-router/config'

import { rdsConfigSchema, tagParamsSchema } from './schemas/rules.js'

const config = new ConfigServiceClient({})

export const configRouter = createConfigRouter()

configRouter
  .route(
    defineRoute({
      filters: { configRuleName: 'rds-encryption', resourceType: 'AWS::RDS::DBInstance' },
      configurationSchema: rdsConfigSchema,
    }).handle(async ({ configurationItem, configurationItemSummary, resultToken }) => {
      if (!configurationItem) {
        logger.info(\`Oversized change for \${configurationItemSummary.resourceId}, skipping\`)
        return
      }
      const compliant = configurationItem.configuration.storageEncrypted
      await report(configurationItem.resourceType, configurationItem.resourceId, compliant, resultToken)
    }),
  )
  .route(
    defineRoute({
      filters: { configRuleName: 'required-tags', resourceType: 'AWS::EC2::Instance' },
      ruleParametersSchema: tagParamsSchema,
    }).handle(async ({ configurationItem, ruleParameters, resultToken }) => {
      if (!configurationItem) return
      const required = JSON.parse(ruleParameters.requiredTags) as string[]
      const compliant = required.every((tag) => tag in configurationItem.tags)
      await report(configurationItem.resourceType, configurationItem.resourceId, compliant, resultToken)
    }),
  )

async function report(type: string, id: string, compliant: boolean, resultToken: string): Promise<void> {
  await config.send(
    new PutEvaluationsCommand({
      ResultToken: resultToken,
      Evaluations: [
        {
          ComplianceResourceType: type,
          ComplianceResourceId: id,
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

export const rdsConfigSchema = z.object({
  storageEncrypted: z.boolean(),
  engineVersion: z.string(),
})

export const tagParamsSchema = z.object({
  requiredTags: z.string(), // JSON-encoded array of tag keys
})`,
  },
]
</script>

<CodeFileViewer :files="files" id="config-example" default-file="config.ts" line-numbers collapse-toggle fixed-height />

The two routes match on distinct rule names, so no change matches both and the order you register them
in makes no difference. Each handler narrows on `configurationItem` so an oversized notification does
not throw, and reports the result with the `resultToken`.

`index.ts` hands the router to `LambdaRouter`, which is what AWS invokes and what every router in the
Lambda gets registered on. See [routers](/docs/routers) for how the two levels of matching fit
together.

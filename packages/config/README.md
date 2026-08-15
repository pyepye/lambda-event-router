# @lambda-event-router/config

Routes AWS Config rule evaluations to handlers by rule name, resource type, resource id or item status. There is one router for configuration changes and one for scheduled evaluations.

**Supported AWS Services:** `AWS Config`

**Available Routers:** `ConfigRouter` | `ConfigScheduledRouter`

**Docs:** [ConfigRouter](https://pyepye.github.io/lambda-event-router/routers/ConfigRouter) | [ConfigScheduledRouter](https://pyepye.github.io/lambda-event-router/routers/ConfigScheduledRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/config
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { configRouter } from './config'
import { scheduledRouter } from './scheduled'

const lambdaRouter = new LambdaRouter({
  routers: [configRouter, scheduledRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// config.ts
import { createConfigRouter, defineRoute } from '@lambda-event-router/config'

export const configRouter = createConfigRouter()

const evaluateInstance = defineRoute({
  filters: {
    configRuleName: 'required-tags',
    resourceType: 'AWS::EC2::Instance',
    resourceId: 'i-0abc123def4567890',
    configurationItemStatus: 'OK',
  },
}).handle(async ({ configRuleName, resultToken }) => {
  console.log(`Evaluating ${configRuleName}, report with token ${resultToken}`)
})

configRouter.route(evaluateInstance)
```

```ts
// scheduled.ts
import { createConfigScheduledRouter, defineConfigScheduledRoute } from '@lambda-event-router/config'

export const scheduledRouter = createConfigScheduledRouter()

const runTagAudit = defineConfigScheduledRoute({
  filters: {
    configRuleName: 'periodic-tag-audit',
    accountId: '123456789012',
  },
}).handle(async ({ accountId, resultToken }) => {
  console.log(`Auditing account ${accountId}, report with token ${resultToken}`)
})

scheduledRouter.route(runTagAudit)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/ConfigRouter#annotated-handlers).

## Documentation

- [ConfigRouter](https://pyepye.github.io/lambda-event-router/routers/ConfigRouter) covers every filter, schema validation, failures and retries
  and reporting evaluations.
- [ConfigScheduledRouter](https://pyepye.github.io/lambda-event-router/routers/ConfigScheduledRouter) covers every filter, schema validation
  and reporting evaluations.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/config](../../service-examples/config) for a deployable app.

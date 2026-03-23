# @lambda-event-router/config

AWS Config rule evaluation routing for configuration change and scheduled evaluations.

**Supported AWS Services:** `AWS Config`

**Available Routers:** `ConfigRouter` | `ConfigScheduledRouter`

(See [Routers](#routers) for more details)

## Install

```bash
npm install @lambda-event-router/config
```


## Quick Start

This example is for the ConfigRouter. See [Usage](#usage) for examples of the other routers

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { configRouter } from './config'

const lambdaRouter = new LambdaRouter({
  routers: [configRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// config.ts
import { createConfigRouter, defineRoute } from '@lambda-event-router/config'

const configRouter = createConfigRouter()

// Inline functions allows Typescript to automatic infer types
const evaluateResource = defineRoute({
  filters: {
    configRuleNames: ['my-custom-rule'],
  },
}).handle(async ({ configurationItem, ruleParameters }) => {
  console.log(`Evaluating ${configurationItem.resourceType}: ${configurationItem.resourceId}`)
})
configRouter.route(evaluateResource)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// config.ts
import { createConfigRouter } from '@lambda-event-router/config'

const configRouter = createConfigRouter()

// Separate handler to define routes and handlers in different places
configRouter.route({
  filters: { configRuleNames: ['my-custom-rule'] },
  handler: evaluateResource,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function evaluateResource({ configurationItem, ruleParameters }) {
  console.log(`Evaluating ${configurationItem.resourceType}: ${configurationItem.resourceId}`)
}
```


## Routers

| AWS Service | Event Source | Router | Usage
|---|---|---|---|
| AWS Config | Configuration Change | `ConfigRouter` | <Usage link here> |
| AWS Config | Scheduled Evaluation | `ConfigScheduledRouter` | <Usage link here> |

See the [AWS Config Resource Type Reference](https://docs.aws.amazon.com/config/latest/developerguide/resource-config-reference.html) for the full schema of each supported resource type.


## Usage

### ConfigRouter

#### Inline handlers

```ts
import { createConfigRouter, defineRoute } from '@lambda-event-router/config'

const configRouter = createConfigRouter()

const evaluateResource = defineRoute({
  filters: {
    configRuleNames: ['my-custom-rule'],
    messageTypes: ['ConfigurationItemChangeNotification'],
  },
}).handle(async ({ configurationItem, ruleParameters }) => {
  console.log(`Evaluating ${configurationItem.resourceType}: ${configurationItem.resourceId}`)
})

configRouter.route(evaluateResource)
```

#### Separate handlers

```ts
import { createConfigRouter } from '@lambda-event-router/config'

const configRouter = createConfigRouter()

configRouter.route({
  filters: {
    configRuleNames: ['my-custom-rule'],
    messageTypes: ['ConfigurationItemChangeNotification'],
  },
  handler: evaluateResource,
})

async function evaluateResource({ configurationItem, ruleParameters }) {
  console.log(`Evaluating ${configurationItem.resourceType}: ${configurationItem.resourceId}`)
}
```

#### Filters

```ts
defineRoute({
  filters: {
    configRuleNames: ['my-custom-rule'],
    messageTypes: ['ConfigurationItemChangeNotification'],
    customFilter: ({ configurationItem }) => configurationItem.resourceType === 'AWS::EC2::Instance',
  },
})
```

### ConfigScheduledRouter

#### Inline handlers

```ts
import { createConfigScheduledRouter, defineConfigScheduledRoute } from '@lambda-event-router/config'

const scheduledRouter = createConfigScheduledRouter()

scheduledRouter.route(
  defineConfigScheduledRoute({
    filters: { configRuleNames: ['compliance-check'] },
  }).handle(async ({ accountId }) => {
    console.log(`Running scheduled compliance check for ${accountId}`)
  })
)
```

#### Separate handlers

```ts
import { createConfigScheduledRouter } from '@lambda-event-router/config'

const scheduledRouter = createConfigScheduledRouter()

scheduledRouter.route({
  filters: { configRuleNames: ['compliance-check'] },
  handler: runComplianceCheck,
})

async function runComplianceCheck({ accountId }) {
  console.log(`Running scheduled compliance check for ${accountId}`)
}
```

## Examples

See the [examples/config](../../examples/config) directory for complete working examples.

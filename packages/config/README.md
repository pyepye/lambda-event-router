# @latcher/config

Routes AWS Config rule evaluations to handlers by rule name, resource type, resource id or item status. There is one matcher for configuration changes and one for scheduled evaluations.

**Supported AWS Services:** `AWS Config`

**Available Matchers:** `ConfigMatcher` | `ConfigScheduledMatcher`

**Docs:** [ConfigMatcher](https://pyepye.github.io/latcher/matchers/ConfigMatcher) | [ConfigScheduledMatcher](https://pyepye.github.io/latcher/matchers/ConfigScheduledMatcher)

## Install

```bash
npm install @latcher/base @latcher/config
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { configMatcher } from './config'
import { scheduledMatcher } from './scheduled'

const latcher = new Latcher({
  matchers: [configMatcher, scheduledMatcher],
})

export const handler = latcher.handler()
```

```ts
// config.ts
import { createConfigMatcher, defineRoute } from '@latcher/config'

export const configMatcher = createConfigMatcher()

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

configMatcher.route(evaluateInstance)
```

```ts
// scheduled.ts
import { createConfigScheduledMatcher, defineConfigScheduledRoute } from '@latcher/config'

export const scheduledMatcher = createConfigScheduledMatcher()

const runTagAudit = defineConfigScheduledRoute({
  filters: {
    configRuleName: 'periodic-tag-audit',
    accountId: '123456789012',
  },
}).handle(async ({ accountId, resultToken }) => {
  console.log(`Auditing account ${accountId}, report with token ${resultToken}`)
})

scheduledMatcher.route(runTagAudit)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/ConfigMatcher#annotated-handlers).

## Documentation

- [ConfigMatcher](https://pyepye.github.io/latcher/matchers/ConfigMatcher) covers every filter, schema validation, failures and retries
  and reporting evaluations.
- [ConfigScheduledMatcher](https://pyepye.github.io/latcher/matchers/ConfigScheduledMatcher) covers every filter, schema validation
  and reporting evaluations.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/config](../../service-examples/config) for a deployable app.

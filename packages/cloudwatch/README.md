# @latcher/cloudwatch

Routes CloudWatch Logs subscription deliveries to handlers by log group, subscription filter or message type. The matcher decodes the gzipped payload into log events for you.

**Supported AWS Services:** `Amazon CloudWatch Logs`

**Available Matchers:** `CloudWatchLogsMatcher`

**Docs:** [CloudWatchLogsMatcher](https://pyepye.github.io/latcher/matchers/CloudWatchLogsMatcher)

## Install

```bash
npm install @latcher/base @latcher/cloudwatch
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { cloudWatchLogsMatcher } from './cloudwatch'

const latcher = new Latcher({
  matchers: [cloudWatchLogsMatcher],
})

export const handler = latcher.handler()
```

```ts
// cloudwatch.ts
import { createCloudWatchLogsMatcher, defineRoute } from '@latcher/cloudwatch'

export const cloudWatchLogsMatcher = createCloudWatchLogsMatcher()

const processLogs = defineRoute({
  filters: {
    logGroup: '/aws/lambda/my-function',
    subscriptionFilter: 'error-alerts',
    messageType: 'DATA_MESSAGE',
  },
}).handle(async ({ logGroup, logEvents }) => {
  console.log(`${logEvents.length} events from ${logGroup}`)
})

cloudWatchLogsMatcher.route(processLogs)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/CloudWatchLogsMatcher#annotated-handlers).

## Documentation

- [CloudWatchLogsMatcher](https://pyepye.github.io/latcher/matchers/CloudWatchLogsMatcher) covers every filter,
  convenience methods, the request object and failures and retries.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/cloudwatch](../../service-examples/cloudwatch) for a deployable app.

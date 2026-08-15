# @lambda-event-router/cloudwatch

Routes CloudWatch Logs subscription deliveries to handlers by log group, subscription filter or message type. The router decodes the gzipped payload into log events for you.

**Supported AWS Services:** `Amazon CloudWatch Logs`

**Available Routers:** `CloudWatchLogsRouter`

**Docs:** [CloudWatchLogsRouter](https://pyepye.github.io/lambda-event-router/routers/CloudWatchLogsRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/cloudwatch
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { cloudWatchLogsRouter } from './cloudwatch'

const lambdaRouter = new LambdaRouter({
  routers: [cloudWatchLogsRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// cloudwatch.ts
import { createCloudWatchLogsRouter, defineRoute } from '@lambda-event-router/cloudwatch'

export const cloudWatchLogsRouter = createCloudWatchLogsRouter()

const processLogs = defineRoute({
  filters: {
    logGroup: '/aws/lambda/my-function',
    subscriptionFilter: 'error-alerts',
    messageType: 'DATA_MESSAGE',
  },
}).handle(async ({ logGroup, logEvents }) => {
  console.log(`${logEvents.length} events from ${logGroup}`)
})

cloudWatchLogsRouter.route(processLogs)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/CloudWatchLogsRouter#annotated-handlers).

## Documentation

- [CloudWatchLogsRouter](https://pyepye.github.io/lambda-event-router/routers/CloudWatchLogsRouter) covers every filter,
  convenience methods, the request object and failures and retries.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/cloudwatch](../../service-examples/cloudwatch) for a deployable app.

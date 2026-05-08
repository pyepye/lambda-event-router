# @lambda-event-router/cloudwatch

CloudWatch Logs subscription routing by log group, log stream, and message type.

**Supported AWS Services:** `Amazon CloudWatch Logs`

**Available Routers:** `CloudWatchLogsRouter`

## Install

```bash
npm install @lambda-event-router/cloudwatch
```


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { cloudwatchRouter } from './cloudwatch'

const lambdaRouter = new LambdaRouter({
  routers: [cloudwatchRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// cloudwatch.ts
import { createCloudWatchLogsRouter, defineRoute } from '@lambda-event-router/cloudwatch'

const cloudwatchRouter = createCloudWatchLogsRouter()

// Inline functions allows Typescript to automatic infer types
const processLogs = defineRoute({
  filters: {
    logGroup: '/aws/lambda/my-function',
    messageType: 'DATA_MESSAGE',
  },
}).handle(async ({ logGroup, logStream, logEvents }) => {
  console.log(`${logEvents.length} events from ${logGroup}/${logStream}`)
})
cloudwatchRouter.route(processLogs)
```

OR use a the separate syntax to split router and handlers across files:

```ts
// cloudwatch.ts
import { createCloudWatchLogsRouter } from '@lambda-event-router/cloudwatch'

const cloudwatchRouter = createCloudWatchLogsRouter()

// Separate handler to define routes and handlers in different places
cloudwatchRouter.dataMessage({
  filters: { logGroup: '/aws/lambda/my-function' },
  handler: processLogs,
})

// Types do need to be explicitly defined - they can not be inferred by Typescript
export async function processLogs({ logGroup, logStream, logEvents }) {
  console.log(`${logEvents.length} events from ${logGroup}/${logStream}`)
}
```


## Usage

#### Inline handlers

```ts
import { createCloudWatchLogsRouter, defineRoute } from '@lambda-event-router/cloudwatch'

const cloudwatchRouter = createCloudWatchLogsRouter()

const processLogs = defineRoute({
  filters: {
    logGroup: '/aws/lambda/my-function',
    messageType: 'DATA_MESSAGE',
  },
}).handle(async ({ logGroup, logStream, logEvents }) => {
  console.log(`${logEvents.length} events from ${logGroup}/${logStream}`)
})

cloudwatchRouter.route(processLogs)
```

#### Separate handlers

```ts
import { createCloudWatchLogsRouter } from '@lambda-event-router/cloudwatch'

const cloudwatchRouter = createCloudWatchLogsRouter()

cloudwatchRouter.dataMessage({
  filters: { logGroup: '/aws/lambda/my-function' },
  handler: processLogs,
})

async function processLogs({ logGroup, logStream, logEvents }) {
  console.log(`${logEvents.length} events from ${logGroup}/${logStream}`)
}
```

#### Helper methods

```ts
cloudwatchRouter.dataMessage()
cloudwatchRouter.controlMessage()
```

#### Filters

```ts
defineRoute({
  filters: {
    logGroup: ['/aws/lambda/my-function', '/aws/lambda/other-function'],
    messageType: 'DATA_MESSAGE',
    customFilter: ({ logEvents }) => logEvents.some(e => e.message.includes('ERROR')),
  },
})
```

## Examples

See the [examples/cloudwatch](../../examples/cloudwatch) directory for complete working examples.

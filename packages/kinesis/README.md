# @latcher/kinesis

Routes each record in a Kinesis Data Streams batch to a handler by stream or partition key. The matcher decodes the data, unpacks aggregated records and runs them in order.

**Supported AWS Services:** `Amazon Kinesis Data Streams`

**Available Matchers:** `KinesisMatcher`

**Docs:** [KinesisMatcher](https://pyepye.github.io/latcher/matchers/KinesisMatcher)

## Install

```bash
npm install @latcher/base @latcher/kinesis
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { kinesisMatcher } from './kinesis'

const latcher = new Latcher({
  matchers: [kinesisMatcher],
})

export const handler = latcher.handler()
```

```ts
// kinesis.ts
import { createKinesisMatcher, defineRoute } from '@latcher/kinesis'
import { z } from 'zod'

export const kinesisMatcher = createKinesisMatcher()

const sensorReading = defineRoute({
  filters: {
    eventSourceArn: 'arn:aws:kinesis:eu-west-2:123456789012:stream/telemetry',
    partitionKey: /^sensor-/,
  },
  dataSchema: z.object({ deviceId: z.string(), celsius: z.number() }),
}).handle(async ({ data }) => {
  console.log(`Device ${data.deviceId} reported ${data.celsius}C`)
})

kinesisMatcher.route(sensorReading)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/KinesisMatcher#annotated-handlers).

## Documentation

- [KinesisMatcher](https://pyepye.github.io/latcher/matchers/KinesisMatcher) covers every filter, schema validation, aggregated records, and failures and retries.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/kinesis](../../service-examples/kinesis) for a deployable app.

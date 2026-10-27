# @latcher/firehose

Routes each record in a Firehose transformation batch to a handler. The matcher decodes the data and turns your return value into the keep, drop or fail result Firehose needs.

**Supported AWS Services:** `Amazon Data Firehose`

**Available Matchers:** `FirehoseMatcher`

**Docs:** [FirehoseMatcher](https://pyepye.github.io/latcher/matchers/FirehoseMatcher)

## Install

```bash
npm install @latcher/base @latcher/firehose
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { firehoseMatcher } from './firehose'

const latcher = new Latcher({
  matchers: [firehoseMatcher],
})

export const handler = latcher.handler()
```

```ts
// firehose.ts
import { createFirehoseMatcher, defineRoute, Ok } from '@latcher/firehose'
import { z } from 'zod'

export const firehoseMatcher = createFirehoseMatcher()

const logLine = defineRoute({
  filters: {
    deliveryStreamArn: 'arn:aws:firehose:eu-west-2:123456789012:deliverystream/web-logs',
    sourceKinesisStreamArn: 'arn:aws:kinesis:eu-west-2:123456789012:stream/web-logs',
  },
  dataSchema: z.object({ path: z.string(), status: z.number() }),
}).handle(async ({ data }) => {
  console.log(`${data.status} on ${data.path}`)
  return Ok({ path: data.path, status: data.status })
})

firehoseMatcher.route(logLine)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/FirehoseMatcher#annotated-handlers).

## Documentation

- [FirehoseMatcher](https://pyepye.github.io/latcher/matchers/FirehoseMatcher) covers every filter, schema validation, responses and dynamic partitioning.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/firehose](../../service-examples/firehose) for a deployable app.

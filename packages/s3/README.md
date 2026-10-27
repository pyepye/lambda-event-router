# @latcher/s3

Routes S3 object notifications to handlers by bucket, key pattern and event name. A second matcher handles S3 Batch Operations tasks and builds the result the job expects.

**Supported AWS Services:** `Amazon S3`

**Available Matchers:** `S3Matcher` | `S3BatchMatcher`

**Docs:** [S3Matcher](https://pyepye.github.io/latcher/matchers/S3Matcher) | [S3BatchMatcher](https://pyepye.github.io/latcher/matchers/S3BatchMatcher)

## Install

```bash
npm install @latcher/base @latcher/s3
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { s3Matcher } from './s3'
import { s3BatchMatcher } from './s3Batch'

const latcher = new Latcher({
  matchers: [s3Matcher, s3BatchMatcher],
})

export const handler = latcher.handler()
```

```ts
// s3.ts
import { createS3Matcher, defineRoute } from '@latcher/s3'

export const s3Matcher = createS3Matcher()

const processUpload = defineRoute({
  filters: {
    eventName: 'ObjectCreated:Put',
    bucket: 'my-app-uploads',
    key: 'uploads/*.csv',
  },
}).handle(async ({ bucket, key, objectSize }) => {
  console.log(`Processing ${key} from ${bucket}, ${objectSize} bytes`)
})

s3Matcher.route(processUpload)
```

```ts
// s3Batch.ts
import { createS3BatchMatcher, Succeeded } from '@latcher/s3'

export const s3BatchMatcher = createS3BatchMatcher()

s3BatchMatcher.route({
  handler: async ({ bucket, key }) => {
    console.log(`Converting ${key} from ${bucket}`)
    return Succeeded(`Converted ${key}`)
  },
})
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/S3Matcher#annotated-handlers).

## Documentation

- [S3Matcher](https://pyepye.github.io/latcher/matchers/S3Matcher) covers every filter, convenience methods,
  the S3 test event and failures and retries.
- [S3BatchMatcher](https://pyepye.github.io/latcher/matchers/S3BatchMatcher) covers task results, schema versions
  and running one Lambda for both matchers.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/s3](../../service-examples/s3) for a deployable app.

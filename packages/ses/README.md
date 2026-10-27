# @latcher/ses

Routes inbound SES email to handlers by receipt status. Your handler gets the sender, subject and recipients already taken out of the event.

**Supported AWS Services:** `Amazon SES`

**Available Matchers:** `SESMatcher`

**Docs:** [SESMatcher](https://pyepye.github.io/latcher/matchers/SESMatcher)

## Install

```bash
npm install @latcher/base @latcher/ses
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { sesMatcher } from './ses'

const latcher = new Latcher({
  matchers: [sesMatcher],
})

export const handler = latcher.handler()
```

```ts
// ses.ts
import { createSESMatcher, defineRoute } from '@latcher/ses'

export const sesMatcher = createSESMatcher()

const supportEmail = defineRoute({
  filters: {
    recipient: 'support@example.com',
    sender: '*@partner.com',
    spamVerdict: 'PASS',
    virusVerdict: 'PASS',
    spfVerdict: 'PASS',
    dkimVerdict: 'PASS',
    dmarcVerdict: 'PASS',
  },
}).handle(async ({ source, subject }) => {
  console.log(`Support email from ${source}: ${subject ?? 'no subject'}`)
})

sesMatcher.route(supportEmail)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/SESMatcher#annotated-handlers).

## Documentation

- [SESMatcher](https://pyepye.github.io/latcher/matchers/SESMatcher) covers every filter, verdicts,
  dispositions and failures.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

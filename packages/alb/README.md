# @latcher/alb

Routes Application Load Balancer requests to handlers by method and path. Your handler returns a body, and the matcher builds the response the load balancer expects.

**Supported AWS Services:** `Application Load Balancer`

**Available Matchers:** `ALBMatcher`

**Docs:** [ALBMatcher](https://pyepye.github.io/latcher/matchers/ALBMatcher)

## Install

```bash
npm install @latcher/base @latcher/alb
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { albMatcher } from './alb'

const latcher = new Latcher({
  matchers: [albMatcher],
})

export const handler = latcher.handler()
```

```ts
// alb.ts
import { createALBMatcher, defineRoute } from '@latcher/alb'
import { z } from 'zod'

export const albMatcher = createALBMatcher()

const createOrder = defineRoute({
  filters: {
    method: 'POST',
    path: '/orgs/:orgId/orders',
  },
  bodySchema: z.object({ item: z.string(), quantity: z.number() }),
}).handle(async ({ path, body }) => {
  console.log(`Creating an order for ${body.quantity} ${body.item} in ${path.orgId}`)
  return { orgId: path.orgId, item: body.item }
})

albMatcher.route(createOrder)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/ALBMatcher#annotated-handlers).

## Documentation

- [ALBMatcher](https://pyepye.github.io/latcher/matchers/ALBMatcher) covers every filter, schema validation, responses
  and CORS.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/alb](../../service-examples/alb) for a deployable app.

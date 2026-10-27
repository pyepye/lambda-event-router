# @latcher/vpclattice

Routes VPC Lattice requests to handlers by method and path. Both payload versions give your handler the same request object, and the matcher builds the response.

**Supported AWS Services:** `Amazon VPC Lattice`

**Available Matchers:** `VPCLatticeMatcher`

**Docs:** [VPCLatticeMatcher](https://pyepye.github.io/latcher/matchers/VPCLatticeMatcher)

## Install

```bash
npm install @latcher/base @latcher/vpclattice
```

`@latcher/base` is a peer dependency, so install it yourself. It exports `Latcher`, which every matcher plugs into.

## Quick Start

```ts
// main handler
import { Latcher } from '@latcher/base'
import { latticeMatcher } from './vpclattice'

const latcher = new Latcher({
  matchers: [latticeMatcher],
})

export const handler = latcher.handler()
```

```ts
// vpclattice.ts
import { createVPCLatticeMatcher, defineRoute } from '@latcher/vpclattice'
import { z } from 'zod'

export const latticeMatcher = createVPCLatticeMatcher()

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

latticeMatcher.route(createOrder)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/latcher/matchers/VPCLatticeMatcher#annotated-handlers).

## Documentation

- [VPCLatticeMatcher](https://pyepye.github.io/latcher/matchers/VPCLatticeMatcher) covers every filter, schema validation, CORS
  and event versions.
- [Handlers](https://pyepye.github.io/latcher/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/vpclattice](../../service-examples/vpclattice) for a deployable app.

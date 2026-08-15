# @lambda-event-router/vpclattice

Routes VPC Lattice requests to handlers by method and path. Both payload versions give your handler the same request object, and the router builds the response.

**Supported AWS Services:** `Amazon VPC Lattice`

**Available Routers:** `VPCLatticeRouter`

**Docs:** [VPCLatticeRouter](https://pyepye.github.io/lambda-event-router/routers/VPCLatticeRouter)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/vpclattice
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.

## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { latticeRouter } from './vpclattice'

const lambdaRouter = new LambdaRouter({
  routers: [latticeRouter],
})

export const handler = lambdaRouter.handler()
```

```ts
// vpclattice.ts
import { createVPCLatticeRouter, defineRoute } from '@lambda-event-router/vpclattice'
import { z } from 'zod'

export const latticeRouter = createVPCLatticeRouter()

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

latticeRouter.route(createOrder)
```

The handler's types come from the route. To name them yourself instead, see
[annotated handlers](https://pyepye.github.io/lambda-event-router/routers/VPCLatticeRouter#annotated-handlers).

## Documentation

- [VPCLatticeRouter](https://pyepye.github.io/lambda-event-router/routers/VPCLatticeRouter) covers every filter, schema validation, CORS
  and event versions.
- [Handlers](https://pyepye.github.io/lambda-event-router/docs/handlers) covers inferred and annotated handlers.

## Examples

See [service-examples/vpclattice](../../service-examples/vpclattice) for a deployable app.

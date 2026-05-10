# @lambda-event-router/vpclattice

VPC Lattice HTTP routing with path parameters, schema validation, and response helpers.

**Supported AWS Services:** `Amazon VPC Lattice`

**Available Routers:** `VPCLatticeRouter`

## Install

```bash
npm install @lambda-event-router/vpclattice
```


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { latticeRouter } from './vpclattice'

const lambdaRouter = new LambdaRouter({
  routers: [latticeRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// vpclattice.ts
import { createVPCLatticeRouter, defineRoute } from '@lambda-event-router/vpclattice'
import { z } from 'zod'

const latticeRouter = createVPCLatticeRouter()

latticeRouter.route(
  defineRoute({
    filters: {
      method: 'GET',
      path: '/items/:itemId',
    },
  }).handle(async ({ path }) => {
    return { statusCode: 200, body: { itemId: path.itemId } }
  })
)
```


## Usage

#### Inline handlers

```ts
import { createVPCLatticeRouter, defineRoute } from '@lambda-event-router/vpclattice'

const latticeRouter = createVPCLatticeRouter()

const updateItemRoute = defineRoute({
  filters: {
    method: 'POST',
    path: '/orgs/:orgId/items/:itemId',
  },
  querySchema: QuerySchema,
  bodySchema: BodySchema,
  responseSchema: ResponseSchema,
}).handle(async ({ path, query, body, auth }) => {
  const { orgId, itemId } = path
  const { dryRun } = query
  return { orgId, itemId, name: body.name, price: body.price, dryRun }
})

latticeRouter.route(updateItemRoute)
```

#### Separate handlers

```ts
import type { ApiRequest, ApiResponse } from '@lambda-event-router/vpclattice'
import { createVPCLatticeRouter, NotFound, Ok } from '@lambda-event-router/vpclattice'

const latticeRouter = createVPCLatticeRouter()

latticeRouter.post({
  filters: {
    path: '/orgs/:orgId/items/:itemId',
  },
  bodySchema: ItemSchema,
  handler: updateItem,
})

// A separate handler needs its types spelling out, since there is no schema in scope to infer from
export async function updateItem(
  request: ApiRequest<{ orgId: string; itemId: string }, Record<string, string | undefined>, Item>,
): Promise<ApiResponse<Item & { orgId: string }>> {
  const { path, body } = request
  const item = await getItem(path.itemId)
  if (!item) {
    throw NotFound({ error: `${path.itemId} not found` })
  }
  return Ok({ orgId: path.orgId, name: body.name, price: body.price })
}
```

#### Helper methods

```ts
latticeRouter.get()
latticeRouter.put()
latticeRouter.post()
latticeRouter.patch()
latticeRouter.delete()
latticeRouter.head()
latticeRouter.options()
```

#### Responses

The helpers take the response body rather than a message string, so pass the object you want on the
wire.

```ts
return { data: ... } // By default this will resolve to a 200 with the body as JSON
return // By default this will resolve to a 204

return Ok(data)
return Created(data)
return NoContent()
// Non-2xx responses are usually thrown, but they can be returned as well
throw TemporaryRedirect(location)
throw PermanentRedirect(location)
throw BadRequest({ error: 'Missing orgId' })
throw Unauthorised()
throw Forbidden()
throw NotFound({ error: `${itemId} not found` })
throw Conflict({ error: 'Item already exists' })
throw UnprocessableContent({ error: 'Price must be positive' })
throw InternalServerError()
```

#### Version adapters

`createVPCLatticeRouter()` handles both payload versions, so there is nothing to configure. The two
per-version adapters are exported for building a router that accepts one version and rejects the other.
`createVPCLatticeRouter` takes no `adapter` option, so that means `HTTPRouter`, which is exported from here
alongside the adapters.

```ts
import { HTTPRouter, vpcLatticeV2Adapter } from '@lambda-event-router/vpclattice'

const v2Only = new HTTPRouter({ adapter: vpcLatticeV2Adapter })
```

## Examples

See the [examples/vpclattice](../../examples/vpclattice) directory for complete working examples.

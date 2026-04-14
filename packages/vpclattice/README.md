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
    filter: {
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
  filter: {
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

latticeRouter.route(updateItemRoute);
```

#### Separate handlers

```ts
import { createVPCLatticeRouter } from '@lambda-event-router/vpclattice'

const latticeRouter = createVPCLatticeRouter()

latticeRouter.post({
  filter: {
    path: '/orgs/:orgId/items/:itemId',
  },
  handler: updateItem
})

export async function updateItem(
  request: ApiRequest<PathParams, QueryParams, Body>,
): Promise<UpdateItemResponse> {
  const item = await getItem(path.itemId);
  if (!item) {
    throw NotFound(`${path.itemId} not found`);
  }
  return { orgId: path.orgId, name: body.name, price: body.price }
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

```ts
return { data: ... } // By default this will resolve to a 200 with the body as JSON
return // By default this will resolve to a 204

return Ok(data)
return Created(data);
return NoContent();
// Throw none positive response (they can also be returned as well)
throw TemporaryRedirect(location);
throw PermanentRedirect(location);
throw BadRequest(errorMessage);
throw Unauthorised(errorMessage);
throw Forbidden(errorMessage);
throw NotFound(errorMessage);
throw Conflict(errorMessage);
throw UnprocessableContent(errorMessage);
throw InternalServerError(errorMessage);
```

#### Version adapters

```ts
import { createVPCLatticeRouter, vpcLatticeV1Adapter, vpcLatticeV2Adapter } from '@lambda-event-router/vpclattice'

const v1Router = createVPCLatticeRouter({ adapter: vpcLatticeV1Adapter })
const v2Router = createVPCLatticeRouter({ adapter: vpcLatticeV2Adapter })
```

## Examples

See the [examples/vpclattice](../../examples/vpclattice) directory for complete working examples.

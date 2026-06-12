# @lambda-event-router/alb

Application Load Balancer HTTP routing with path parameters, schema validation, and response helpers.

**Supported AWS Services:** `Application Load Balancer`

**Available Routers:** `ALBRouter`

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/alb
```

`@lambda-event-router/base` is a peer dependency, so install it yourself. It exports `LambdaRouter`, which every router plugs into.


## Quick Start

```ts
// main handler
import { LambdaRouter } from '@lambda-event-router/base'
import { albRouter } from './alb'

const lambdaRouter = new LambdaRouter({
  routers: [albRouter]
})

export const handler = lambdaRouter.handler()
```

```ts
// alb.ts
import { createALBRouter, defineRoute } from '@lambda-event-router/alb'
import { z } from 'zod'

const albRouter = createALBRouter()

albRouter.route(
  defineRoute({
    filters: {
      method: 'POST',
      path: '/orgs/:orgId/items/:itemId',
    },
    bodySchema: z.object({ name: z.string(), price: z.number() }),
  }).handle(async ({ path, body }) => {
    return { statusCode: 201, body: { orgId: path.orgId, itemId: path.itemId, name: body.name } }
  })
)
```


## Usage

#### Inline handlers

```ts
import { createALBRouter, defineRoute } from '@lambda-event-router/alb'

const albRouter = createALBRouter()

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

albRouter.route(updateItemRoute)
```

#### Separate handlers

```ts
import type { ApiRequest, ApiResponse } from '@lambda-event-router/alb'
import { createALBRouter, NotFound, Ok } from '@lambda-event-router/alb'

const albRouter = createALBRouter()

albRouter.post({
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
albRouter.get()
albRouter.put()
albRouter.post()
albRouter.patch()
albRouter.delete()
albRouter.head()
albRouter.options()
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

## Examples

See the [examples/alb](../../examples/alb) directory for complete working examples.

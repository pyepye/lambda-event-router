# @lambda-event-router/alb

Application Load Balancer HTTP routing with path parameters, schema validation, and response helpers.

**Supported AWS Services:** `Application Load Balancer`

**Available Routers:** `ALBRouter`

## Install

```bash
npm install @lambda-event-router/alb
```


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
    method: 'POST',
    path: '/orgs/:orgId/items/:itemId',
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
  method: 'POST',
  path: '/orgs/:orgId/items/:itemId',
  querySchema: QuerySchema,
  bodySchema: BodySchema,
  responseSchema: ResponseSchema,
}).handle(async ({ path, query, body, auth }) => {
  const { orgId, itemId } = path
  const { dryRun } = query
  return { orgId, itemId, name: body.name, price: body.price, dryRun }
})

albRouter.route(updateItemRoute);
```

#### Separate handlers

```ts
import { createALBRouter } from '@lambda-event-router/alb'

const albRouter = createALBRouter()

albRouter.post({
  path: '/orgs/:orgId/items/:itemId',
  handler: updateItem
})

export async function updateItem(
  request: ApiRequest<PathParams, QueryParams, Body>,
): Promise<ApiResponse<UpdateItemResponse>> {
  const item = await getItem(path.itemId);
  if (!item) {
    throw NotFound(`${path.itemId} not found`);
  }
  return { orgId: path.orgId, name: body.name, price: body.price }
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

## Examples

See the [examples/alb](../../examples/alb) directory for complete working examples.

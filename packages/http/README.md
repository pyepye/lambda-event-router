# @lambda-event-router/http

Abstract HTTP handler shared by API Gateway, ALB, and VPC Lattice routers. Provides route definitions, request/response types, and response helpers.

This package is typically not installed directly. Instead, use one of the HTTP service packages: `@lambda-event-router/apigateway`, `@lambda-event-router/alb`, or `@lambda-event-router/vpclattice`.

**Supported AWS Services:** `Amazon API Gateway` | `Application Load Balancer` | `Amazon VPC Lattice`

**Available Routers:** None (shared HTTP utilities)

## Install

```bash
npm install @lambda-event-router/base @lambda-event-router/http
```

`@lambda-event-router/base` is a peer dependency, so install it yourself.

## Quick Start

```ts
import { defineRoute } from '@lambda-event-router/http'
import { z } from 'zod'

// An inferred handler takes its types from the route
const getItemRoute = defineRoute({
  filters: {
    method: 'GET',
    path: '/orgs/:orgId/items/:itemId',
  },
}).handle(async ({ path }) => {
  return { statusCode: 200, body: { orgId: path.orgId, itemId: path.itemId } }
})
```


## Usage

#### Inferred handlers

```ts
import { defineRoute } from '@lambda-event-router/http'
import { z } from 'zod'

const QuerySchema = z.object({
  dryRun: z.coerce.boolean().default(false),
})

const BodySchema = z.object({
  name: z.string(),
  price: z.number(),
})

const ResponseSchema = z.object({
  itemId: z.string(),
  name: z.string(),
  price: z.number(),
})

const createItemRoute = defineRoute({
  filters: {
    method: 'POST',
    path: '/items',
  },
  querySchema: QuerySchema,
  bodySchema: BodySchema,
  responseSchema: ResponseSchema,
}).handle(async ({ body, query }) => {
  return { statusCode: 201, body: { itemId: '123', name: body.name, price: body.price } }
})
```

#### Responses

A route answers with JSON unless you set its `responseType` to `html`, `text` or `binary`. An HTML route
returns `Html(...)` and needs `errors.html` on its router.

```ts
import { defineRoute } from '@lambda-event-router/http'

const healthRoute = defineRoute({
  filters: {
    method: 'GET',
    path: '/health',
  },
  responseType: 'text',
}).handle(async () => 'ok')
```

```ts
import { BadRequest, NotFound, Unauthorized, Forbidden, InternalServerError } from '@lambda-event-router/http'

// Throw error responses
throw BadRequest('Invalid input')
throw NotFound('Item not found')
throw Unauthorized()
```

## Examples

See the `@lambda-event-router/apigateway`, `@lambda-event-router/alb`, or `@lambda-event-router/vpclattice` packages for complete working examples.

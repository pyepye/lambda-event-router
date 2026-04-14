# @lambda-event-router/http

Abstract HTTP handler shared by API Gateway, ALB, and VPC Lattice routers. Provides route definitions, request/response types, and response helpers.

This package is typically not installed directly. Instead, use one of the HTTP service packages: `@lambda-event-router/apigateway`, `@lambda-event-router/alb`, or `@lambda-event-router/vpclattice`.

**Supported AWS Services:** `Amazon API Gateway` | `Application Load Balancer` | `Amazon VPC Lattice`

**Available Routers:** None (shared HTTP utilities)

## Install

```bash
npm install @lambda-event-router/http
```


## Quick Start

```ts
import { defineRoute } from '@lambda-event-router/http'
import { z } from 'zod'

// Inline functions allows Typescript to automatic infer types
const getItemRoute = defineRoute({
  filter {
    method: 'GET',
    path: '/orgs/:orgId/items/:itemId',
  },
}).handle(async ({ path }) => {
  return { statusCode: 200, body: { orgId: path.orgId, itemId: path.itemId } }
})
```


## Usage

#### Inline handlers

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
  filter {
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

```ts
import { BadRequest, NotFound, Unauthorised, Forbidden, InternalServerError } from '@lambda-event-router/http'

// Throw error responses
throw BadRequest('Invalid input')
throw NotFound('Item not found')
throw Unauthorised()
```

## Examples

See the `@lambda-event-router/apigateway`, `@lambda-event-router/alb`, or `@lambda-event-router/vpclattice` packages for complete working examples.

import { z } from 'zod';

import { BadRequest, defineRoute, Ok, Unauthorised } from '@lambda-event-router/vpclattice';

const QuerySchema = z.object({
  dryRun: z.coerce.boolean().default(false),
});

const BodySchema = z.object({
  name: z.string(),
  price: z.number(),
});

const ResponseSchema = z.object({
  orgId: z.string(),
  itemId: z.string(),
  name: z.string(),
  price: z.number(),
  dryRun: z.boolean(),
});

export const createItemRoute = defineRoute({
  filters: {
    method: 'POST',
    path: '/orgs/:orgId/items/:itemId',
  },
  querySchema: QuerySchema,
  bodySchema: BodySchema,
  responseSchema: ResponseSchema,
}).handle(async (request) => {
  const { orgId, itemId } = request.path;
  const { dryRun } = request.query;
  const { name, price } = request.body;
  const { auth } = request;
  if (!auth) {
    throw Unauthorised();
  }
  return {
    statusCode: 201,
    body: { orgId, itemId, name, price, dryRun },
  };
});

export const updateItemRoute = defineRoute({
  filters: {
    method: 'PUT',
    path: '/orgs/:orgId/items/:itemId',
  },
  querySchema: QuerySchema,
  bodySchema: BodySchema,
  responseSchema: ResponseSchema,
}).handle(async (request) => {
  const { orgId, itemId } = request.path;
  const { dryRun } = request.query;
  const { name, price } = request.body;
  if (dryRun) {
    throw BadRequest('Dry run not supported for this');
  }
  return Ok({ orgId, itemId, name, price, dryRun });
});

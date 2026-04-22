import { z } from 'zod';

import { type ApiRequest, type ApiResponse, BadRequest } from '@lambda-event-router/vpclattice';

export const CreateItemBodySchema = z.object({
  name: z.string(),
  price: z.number(),
});

export const QuerySchema = z.object({
  dryRun: z.string().default('false'),
});

type PathParams = { orgId: string; itemId: string };
type QueryParams = { dryRun?: string };
type Body = z.infer<typeof CreateItemBodySchema>;

interface CreateItemResponse {
  orgId: string;
  itemId: string;
  name: string;
  price: number;
  dryRun: boolean;
}

export async function createItem(
  request: ApiRequest<PathParams, QueryParams, Body>,
): Promise<ApiResponse<CreateItemResponse>> {
  const { orgId, itemId } = request.path;
  const { dryRun } = request.query;
  const { name, price } = request.body;

  if (dryRun) {
    throw BadRequest('Dry run not supported for this');
  }

  return {
    statusCode: 201,
    body: { orgId, itemId, name, price, dryRun: Boolean(dryRun) },
  };
}

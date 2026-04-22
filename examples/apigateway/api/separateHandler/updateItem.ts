import { z } from 'zod';

import { type ApiRequest, BadRequest } from '@lambda-event-router/apigateway';

export const UpdateItemBodySchema = z.object({
  name: z.string(),
  price: z.number(),
});

export const QuerySchema = z.object({
  dryRun: z.string().default('false'),
});

type PathParams = { orgId: string; itemId: string };
type QueryParams = { dryRun?: string };
type Body = z.infer<typeof UpdateItemBodySchema>;

interface UpdateItemResponse {
  orgId: string;
  itemId: string;
  name: string;
  price: number;
  dryRun: boolean;
}

export async function updateItem(request: ApiRequest<PathParams, QueryParams, Body>): Promise<UpdateItemResponse> {
  const { orgId, itemId } = request.path;
  const { dryRun } = request.query;
  const { name, price } = request.body;

  if (dryRun) {
    throw BadRequest('Dry run not supported for this');
  }

  return { orgId, itemId, name, price, dryRun: Boolean(dryRun) };
  /*
  Will get automatically converted into
  return {
    statusCode: 200,
    body: { orgId, itemId, name, price, dryRun: Boolean(dryRun) },
    headers: { 'content-type': 'application/json' },
  };
  */
}

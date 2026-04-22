import { z } from 'zod';

import type { SQSMessageAttributes, SQSRequest, SQSResponse } from '@lambda-event-router/sqs';

export const CreateItemBodySchema = z.object({
  orgId: z.string(),
  itemId: z.number(),
});

export const MessageAttributesSchema = z.object({
  dryRun: z.string(),
});
type CreateItemBody = z.infer<typeof CreateItemBodySchema>;
type CreateItemMessageAttrs = z.infer<typeof MessageAttributesSchema>;

export async function createItem(request: SQSRequest<CreateItemBody, CreateItemMessageAttrs>): Promise<SQSResponse> {
  const { orgId, itemId } = request.body;

  console.log('Creating item:', { orgId, itemId });
}

interface Body {
  orgId: string;
  itemId: string;
}

interface CreateItemMessageAttributes extends SQSMessageAttributes {
  someAttribute: string;
}

export async function createItemOther(request: SQSRequest<Body, CreateItemMessageAttributes>): Promise<SQSResponse> {
  const { orgId, itemId } = request.body;

  console.log('Creating item:', { orgId, itemId });
}

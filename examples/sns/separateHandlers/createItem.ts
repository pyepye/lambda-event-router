import { z } from 'zod';

import type { SNSMessageAttributes, SNSRequest, SNSResponse } from '@lambda-event-router/sns';

export const CreateItemBodySchema = z.object({
  orgId: z.string(),
  itemId: z.number(),
});

export const MessageAttributesSchema = z.object({
  dryRun: z.string(),
});

type CreateItemBody = z.infer<typeof CreateItemBodySchema>;
type CreateItemMessageAttrs = z.infer<typeof MessageAttributesSchema>;

export async function createItem(request: SNSRequest<CreateItemBody, CreateItemMessageAttrs>): Promise<SNSResponse> {
  const { orgId, itemId } = request.body;

  console.log('Creating item:', { orgId, itemId });
}

interface Body {
  orgId: string;
  itemId: string;
}

interface CreateItemMessageAttributes extends SNSMessageAttributes {
  someAttribute: string;
}

export async function createItemOther(request: SNSRequest<Body, CreateItemMessageAttributes>): Promise<SNSResponse> {
  const { orgId, itemId } = request.body;

  console.log('Creating item:', { orgId, itemId });
}

import { z } from 'zod';

import { defineRoute, type SNSFilterInput } from '@lambda-event-router/sns';

const SOME_TOPIC_ARN = 'arn:aws:sns:region:account-id:some-topic';
const SOME_DL_TOPIC_ARN = 'arn:aws:sns:region:account-id:some-dl-topic';

const BodySchema = z.object({
  name: z.string(),
  price: z.number(),
});

const MessageAttributesSchema = z.object({
  dryRun: z.coerce.boolean().default(false),
});

export const createItemRoute = defineRoute({
  filters: {
    topicArn: [SOME_TOPIC_ARN, SOME_DL_TOPIC_ARN],
  },
  bodySchema: BodySchema,
  messageAttributesSchema: MessageAttributesSchema,
}).handle(async (request) => {
  const { name, price } = request.body;
  const { dryRun } = request.messageAttributes;
  console.log(`Creating item: ${name} with price ${price} - dryRun: ${dryRun}`);
});

// Route that only matches urgent notifications using customFilter
export const urgentNotificationRoute = defineRoute({
  filters: {
    topicArn: [SOME_TOPIC_ARN],
    customFilter: ({ body }: SNSFilterInput) => {
      if (typeof body !== 'object' || body === null) return false;
      if (!('urgency' in body) || typeof body.urgency !== 'string') return false;
      return body.urgency === 'CRITICAL';
    },
  },
  bodySchema: BodySchema,
}).handle(async (request) => {
  const { name, price } = request.body;
  console.log(`Urgent notification: ${name} - ${price}`);
});

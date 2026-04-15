import { defineRoute, type SQSFilterInput } from '@lambda-event-router/sqs';
import { z } from 'zod';

const SOME_QUEUE_ARN = 'arn:aws:sqs:region:account-id:some-queue';
const SOME_DL_QUEUE_ARN = 'arn:aws:sqs:region:account-id:some-dl-queue';

const BodySchema = z.object({
  name: z.string(),
  price: z.number(),
});

const MessageAttributesSchema = z.object({
  dryRun: z.coerce.boolean().default(false),
});

export const createItemRoute = defineRoute({
  filters: {
    eventSourceArn: [SOME_QUEUE_ARN, SOME_DL_QUEUE_ARN],
  },
  bodySchema: BodySchema,
  messageAttributesSchema: MessageAttributesSchema,
}).handle(async (request) => {
  const { name, price } = request.body;
  const { dryRun } = request.messageAttributes;
  console.log(`Creating item: ${name} with price ${price} - ${dryRun}`);
});

const HIGH_VALUE_THRESHOLD = 1000;

// Route that only matches high-value orders using customFilter
export const highValueOrderRoute = defineRoute({
  filters: {
    eventSourceArn: [SOME_QUEUE_ARN],
    customFilter: ({ body }: SQSFilterInput) => {
      if (typeof body !== 'object' || body === null) return false;
      if (!('total' in body) || typeof body.total !== 'number') return false;
      return body.total > HIGH_VALUE_THRESHOLD;
    },
  },
  bodySchema: BodySchema,
}).handle(async (request) => {
  const { name, price } = request.body;
  console.log(`High-value order: ${name} with price ${price}`);
});
